(function (root, factory) {
    const optimizer = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = optimizer;
    }
    root.WynnOptimizer = optimizer;
})(globalThis, function () {
    const SKILLS = [
        { key: "str", req: "strReq", label: "Força" },
        { key: "dex", req: "dexReq", label: "Destreza" },
        { key: "int", req: "intReq", label: "Inteligência" },
        { key: "def", req: "defReq", label: "Defesa" },
        { key: "agi", req: "agiReq", label: "Agilidade" }
    ];
    const EQUIPMENT_SLOTS = [
        ["helmet", "armor"],
        ["chestplate", "armor"],
        ["leggings", "armor"],
        ["boots", "armor"],
        ["ring", "accessory"],
        ["ring", "accessory"],
        ["bracelet", "accessory"],
        ["necklace", "accessory"]
    ];
    const CLASS_WEAPONS = {
        archer: "bow",
        warrior: "spear",
        assassin: "dagger",
        mage: "wand",
        shaman: "relik"
    };

    function skillPointsAtLevel(level) {
        const safeLevel = Math.max(1, Math.min(121, Number(level) || 1));
        return Math.min(200, (safeLevel - 1) * 2);
    }

    function isTradable(item) {
        return item.restrict !== "untradable" && item.restrict !== "quest_item";
    }

    function getSetMembership(sets) {
        const membership = new Map();
        for (const [setName, set] of Object.entries(sets || {})) {
            for (const itemName of set.items || []) {
                membership.set(itemName, setName);
            }
        }
        return membership;
    }

    function getItemSetCounts(items) {
        const counts = new Map();
        for (const item of items) {
            if (item.setName) counts.set(item.setName, (counts.get(item.setName) || 0) + 1);
        }
        return counts;
    }

    function getSetBonus(set, count) {
        if (!set || count < 1 || !set.bonuses || !set.bonuses.length) return {};
        return set.bonuses[Math.min(count, set.bonuses.length) - 1] || {};
    }

    function getBuildStats(items, sets) {
        const stats = Object.create(null);
        const counts = getItemSetCounts(items);
        for (const item of items) {
            for (const [key, value] of Object.entries(item)) {
                if (typeof value === "number" && Number.isFinite(value)) {
                    stats[key] = (stats[key] || 0) + value;
                }
            }
        }
        for (const [setName, count] of counts) {
            for (const [key, value] of Object.entries(getSetBonus(sets[setName], count))) {
                if (typeof value === "number" && Number.isFinite(value)) {
                    stats[key] = (stats[key] || 0) + value;
                }
            }
        }
        return stats;
    }

    function computeScales(items, sets, priorityKeys) {
        const values = Object.fromEntries(priorityKeys.map(key => [key, []]));
        for (const item of items) {
            for (const key of priorityKeys) {
                const value = Number(item[key]);
                if (Number.isFinite(value) && value !== 0) values[key].push(Math.abs(value));
            }
        }
        for (const set of Object.values(sets || {})) {
            for (const bonus of set.bonuses || []) {
                for (const key of priorityKeys) {
                    const value = Number(bonus[key]);
                    if (Number.isFinite(value) && value !== 0) values[key].push(Math.abs(value));
                }
            }
        }
        const scales = Object.create(null);
        for (const key of priorityKeys) {
            const sorted = values[key].sort((a, b) => a - b);
            scales[key] = sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.9)] : 1;
            if (!scales[key]) scales[key] = 1;
        }
        return scales;
    }

    function scoreStats(stats, weights, scales) {
        let score = 0;
        const breakdown = Object.create(null);
        for (const [key, rawWeight] of Object.entries(weights)) {
            const weight = Number(rawWeight) || 0;
            const contribution = weight * (Number(stats[key]) || 0) / (scales[key] || 1);
            breakdown[key] = contribution;
            score += contribution;
        }
        return { score, breakdown };
    }

    function satisfiesConstraints(stats, constraints) {
        for (const [key, rawMinimum] of Object.entries(constraints || {})) {
            const minimum = Number(rawMinimum);
            if (!Number.isFinite(minimum)) {
                throw new Error(`Limite inválido para o atributo ${key}.`);
            }
            if ((Number(stats[key]) || 0) < minimum) return false;
        }
        return true;
    }

    function requiredBaseEstimate(items, sets) {
        const stats = getBuildStats(items, sets);
        let points = 0;
        for (const skill of SKILLS) {
            const threshold = Math.max(0, ...items.map(item =>
                (Number(item[skill.req]) || 0) + (Number(item[skill.key]) || 0)
            ));
            points += Math.max(0, threshold - (Number(stats[skill.key]) || 0));
        }
        return points;
    }

    function canUseItem(item, level, className) {
        if (Number(item.lvl) > level) return false;
        if (item.classReq && item.classReq !== className) return false;
        return true;
    }

    function getCandidates(data, slot, config, membership, scales) {
        const weapon = slot === "weapon";
        const [type, category] = weapon ? [CLASS_WEAPONS[config.className], "weapon"] : EQUIPMENT_SLOTS[slot];
        const items = data.items.filter(item =>
            item.remapID === undefined &&
            typeof item.displayName === "string" &&
            typeof item.name === "string" &&
            item.category === category &&
            item.type === type &&
            canUseItem(item, config.level, config.className)
        );
        const fixedName = (config.fixed[slot] || "").trim();
        if (fixedName) {
            const exact = items.filter(item =>
                item.displayName.toLocaleLowerCase() === fixedName.toLocaleLowerCase() ||
                item.name.toLocaleLowerCase() === fixedName.toLocaleLowerCase()
            );
            if (exact.length === 1) return exact;
            if (exact.length > 1) {
                throw new Error(`O nome "${fixedName}" corresponde a mais de um item no espaço ${slot}.`);
            }
            throw new Error(`"${fixedName}" não é um item compatível com ${slot}, classe e nível informados.`);
        }
        if (!items.length) throw new Error(`Não há itens disponíveis para o espaço ${slot} nesse nível.`);

        const weights = config.weights || {};
        const ranked = items.map(item => {
            const itemScore = scoreStats(item, weights, scales).score;
            const healthScore = (Number(item.hp) || 0) + (Number(item.hpBonus) || 0);
            const skillBonus = SKILLS.reduce((sum, skill) => sum + (Number(item[skill.key]) || 0), 0);
            const requirements = SKILLS.reduce((sum, skill) => sum + (Number(item[skill.req]) || 0), 0);
            return {
                item,
                score: itemScore + skillBonus * 0.025 - requirements * 0.012,
                healthScore,
                preferenceScore: itemScore
            };
        }).sort((a, b) => config.mode === "intelligent"
            ? b.healthScore - a.healthScore || b.preferenceScore - a.preferenceScore || b.score - a.score
            : b.score - a.score);
        const selected = new Map();
        const keep = item => selected.set(item.id, item);
        for (const entry of ranked.slice(0, 38)) keep(entry.item);
        for (const skill of SKILLS) {
            const helpful = [...items].sort((a, b) =>
                (Number(b[skill.key]) || 0) - (Number(a[skill.key]) || 0)
            );
            helpful.slice(0, 3).forEach(keep);
            const lowRequirement = [...items].sort((a, b) =>
                ((Number(a[skill.req]) || 0) - (Number(a[skill.key]) || 0)) -
                ((Number(b[skill.req]) || 0) - (Number(b[skill.key]) || 0))
            );
            lowRequirement.slice(0, 2).forEach(keep);
        }
        return [...selected.values()];
    }

    function getTotalSkillBonuses(items, sets) {
        const stats = getBuildStats(items, sets);
        return SKILLS.map(skill => Number(stats[skill.key]) || 0);
    }

    function findEquipPlan(equipment, weapon, sets, availablePoints) {
        const items = equipment.concat(weapon);
        const totalBonuses = getTotalSkillBonuses(items, sets);
        const minimumAssigned = SKILLS.map((skill, i) => {
            const threshold = Math.max(0, ...items.map(item =>
                (Number(item[skill.req]) || 0) + (Number(item[skill.key]) || 0)
            ));
            return Math.max(0, threshold - totalBonuses[i]);
        });
        if (minimumAssigned.some(points => points > 100) ||
            minimumAssigned.reduce((sum, points) => sum + points, 0) > availablePoints) {
            return null;
        }

        const fullMask = (1 << equipment.length) - 1;
        const memo = new Map();
        let best = null;

        function search(mask, assigned, order) {
            const used = assigned.reduce((sum, points) => sum + points, 0);
            if (used > availablePoints || (best && used >= best.assigned.reduce((a, b) => a + b, 0))) return;
            const stateKey = `${mask}:${assigned.join(",")}`;
            if (memo.has(stateKey) && memo.get(stateKey) <= used) return;
            memo.set(stateKey, used);

            if (mask === fullMask) {
                const currentSkill = getTotalSkillBonuses(equipment, sets);
                const finalAssigned = assigned.slice();
                for (let i = 0; i < SKILLS.length; i++) {
                    const required = Number(weapon[SKILLS[i].req]) || 0;
                    const deficit = required - (finalAssigned[i] + currentSkill[i]);
                    if (deficit > 0) finalAssigned[i] += deficit;
                }
                const finalStats = getBuildStats(items, sets);
                for (let i = 0; i < SKILLS.length; i++) {
                    const threshold = Math.max(0, ...items.map(item =>
                        (Number(item[SKILLS[i].req]) || 0) + (Number(item[SKILLS[i].key]) || 0)
                    ));
                    const deficit = threshold - (finalAssigned[i] + (Number(finalStats[SKILLS[i].key]) || 0));
                    if (deficit > 0) finalAssigned[i] += deficit;
                }
                const totalUsed = finalAssigned.reduce((sum, points) => sum + points, 0);
                if (finalAssigned.some(points => points > 100) || totalUsed > availablePoints) return;
                const valid = items.every(item => SKILLS.every((skill, i) =>
                    finalAssigned[i] + (Number(finalStats[skill.key]) || 0) >=
                    (Number(item[skill.req]) || 0) + (Number(item[skill.key]) || 0)
                ));
                if (valid && (!best || totalUsed < best.assigned.reduce((a, b) => a + b, 0))) {
                    best = { assigned: finalAssigned, order: order.concat(weapon) };
                }
                return;
            }

            const currentItems = equipment.filter((_, i) => mask & (1 << i));
            const currentSkill = getTotalSkillBonuses(currentItems, sets);
            const choices = [];
            for (let i = 0; i < equipment.length; i++) {
                if (mask & (1 << i)) continue;
                const nextAssigned = assigned.slice();
                let added = 0;
                for (let j = 0; j < SKILLS.length; j++) {
                    const required = Number(equipment[i][SKILLS[j].req]) || 0;
                    const deficit = required - (nextAssigned[j] + currentSkill[j]);
                    if (deficit > 0) {
                        nextAssigned[j] += deficit;
                        added += deficit;
                    }
                }
                const nextMask = mask | (1 << i);
                const nextItems = equipment.filter((_, itemIndex) => nextMask & (1 << itemIndex));
                const nextSkill = getTotalSkillBonuses(nextItems, sets);
                for (let j = 0; j < SKILLS.length; j++) {
                    const threshold = Math.max(0, ...nextItems.map(item =>
                        (Number(item[SKILLS[j].req]) || 0) + (Number(item[SKILLS[j].key]) || 0)
                    ));
                    const deficit = threshold - (nextAssigned[j] + nextSkill[j]);
                    if (deficit > 0) {
                        nextAssigned[j] += deficit;
                        added += deficit;
                    }
                }
                if (nextAssigned.some(points => points > 100) ||
                    nextAssigned.reduce((sum, points) => sum + points, 0) > availablePoints) continue;
                choices.push({ index: i, assigned: nextAssigned, added });
            }
            choices.sort((a, b) => a.added - b.added);
            for (const choice of choices) {
                search(mask | (1 << choice.index), choice.assigned, order.concat(equipment[choice.index]));
            }
        }

        search(0, minimumAssigned, []);
        return best;
    }

    function makeState(items, sets, config, scales) {
        const stats = getBuildStats(items, sets);
        const scored = config.mode === "intelligent"
            ? {
                score: (Number(stats.hp) || 0) + (Number(stats.hpBonus) || 0),
                breakdown: {
                    hp: Number(stats.hp) || 0,
                    hpBonus: Number(stats.hpBonus) || 0
                }
            }
            : scoreStats(stats, config.weights, scales);
        const preferenceScored = config.mode === "intelligent"
            ? scoreStats(stats, config.weights, scales)
            : scored;
        const skillCost = requiredBaseEstimate(items, sets);
        const constraintPenalty = Object.entries(config.constraints || {}).reduce((penalty, [key, minimum]) =>
            penalty + Math.max(0, Number(minimum) - (Number(stats[key]) || 0)) * 20,
        0);
        return {
            items,
            stats,
            score: scored.score,
            breakdown: scored.breakdown,
            preferenceScore: preferenceScored.score,
            preferenceBreakdown: preferenceScored.breakdown,
            heuristic: scored.score - skillCost * 0.045 - constraintPenalty
        };
    }

    async function optimize(data, config) {
        const mode = config.mode || "manual";
        if (!["manual", "assisted", "intelligent"].includes(mode)) {
            throw new Error("Modo de otimização inválido.");
        }
        const constraints = Object.fromEntries(Object.entries(config.constraints || {}).map(([key, value]) => {
            const minimum = Number(value);
            if (!Number.isFinite(minimum)) {
                throw new Error(`Limite inválido para o atributo ${key}.`);
            }
            return [key, minimum];
        }));
        const weights = config.weights || {};
        config = { ...config, mode, weights, constraints };
        const availablePoints = skillPointsAtLevel(config.level);
        const membership = getSetMembership(data.sets);
        const items = data.items.map(item => {
            item.setName = membership.get(item.name) || null;
            return item;
        });
        const priorityKeys = [...new Set([
            ...Object.keys(weights),
            ...(mode === "intelligent" ? ["hp", "hpBonus"] : [])
        ])];
        if (mode !== "intelligent" && !priorityKeys.some(key => Number(weights[key]) > 0)) {
            throw new Error("Escolha ao menos uma prioridade com peso maior que zero.");
        }
        const scales = computeScales(items, data.sets, priorityKeys);
        const slots = Array.from({ length: 9 }, (_, i) => i).map(i =>
            getCandidates({ items, sets: data.sets }, i === 8 ? "weapon" : i, config, membership, scales)
        );

        let beam = [{ items: [], heuristic: 0 }];
        for (const candidates of slots) {
            const next = new Map();
            for (const state of beam) {
                for (const item of candidates) {
                    const chosen = state.items.concat(item);
                    const evaluated = makeState(chosen, data.sets, config, scales);
                    const key = chosen.map(entry => entry.id).join("-");
                    const current = next.get(key);
                    if (!current || evaluated.heuristic > current.heuristic) next.set(key, evaluated);
                }
            }
            const width = next.size > 2000 ? 150 : 600;
            beam = [...next.values()]
                .sort((a, b) => mode === "intelligent"
                    ? b.score - a.score ||
                        b.preferenceScore - a.preferenceScore ||
                        b.heuristic - a.heuristic
                    : b.heuristic - a.heuristic)
                .slice(0, width);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const results = [];
        for (const state of beam) {
            if (!satisfiesConstraints(state.stats, config.constraints)) continue;
            const equipment = state.items.slice(0, 8);
            const weapon = state.items[8];
            const plan = findEquipPlan(equipment, weapon, data.sets, availablePoints);
            if (!plan) continue;
            results.push({
                items: state.items,
                stats: state.stats,
                score: state.score,
                breakdown: state.breakdown,
                preferenceScore: state.preferenceScore,
                preferenceBreakdown: state.preferenceBreakdown,
                assigned: plan.assigned,
                equipOrder: plan.order,
                availablePoints
            });
        }
        results.sort((a, b) =>
            b.score - a.score ||
            b.preferenceScore - a.preferenceScore ||
            a.assigned.reduce((sum, value) => sum + value, 0) -
                b.assigned.reduce((sum, value) => sum + value, 0)
        );
        const unique = [];
        const seen = new Set();
        for (const result of results) {
            const key = result.items.map(item => item.id).join("-");
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(result);
            if (unique.length === 5) break;
        }
        return { results: unique, candidateCounts: slots.map(list => list.length), availablePoints };
    }

    return {
        SKILLS,
        CLASS_WEAPONS,
        EQUIPMENT_SLOTS,
        skillPointsAtLevel,
        isTradable,
        getBuildStats,
        satisfiesConstraints,
        findEquipPlan,
        optimize
    };
});
