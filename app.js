(() => {
    const SLOT_IDS = [
        "helmet", "chestplate", "leggings", "boots",
        "ring1", "ring2", "bracelet", "necklace", "weapon"
    ];
    const SLOT_LABELS = {
        helmet: "Capacete",
        chestplate: "Peitoral",
        leggings: "Calças",
        boots: "Botas",
        ring1: "Anel 1",
        ring2: "Anel 2",
        bracelet: "Bracelete",
        necklace: "Colar",
        weapon: "Arma"
    };
    const PRIORITIES = {
        mr: ["Mana Regen", "weight-mr"],
        sdPct: ["Spell Damage % geral", "weight-sdPct"],
        sdRaw: ["Spell Damage Raw geral", "weight-sdRaw"],
        mdPct: ["Main Attack %", "weight-mdPct"],
        mdRaw: ["Main Attack Raw", "weight-mdRaw"],
        hprPct: ["Health Regen %", "weight-hprPct"],
        hprRaw: ["Health Regen Raw", "weight-hprRaw"],
        spd: ["Walk Speed", "weight-spd"],
        hpBonus: ["Health", "weight-hpBonus"],
        ms: ["Mana Steal", "weight-ms"],
        ls: ["Life Steal", "weight-ls"],
        str: ["Força", "weight-str"],
        dex: ["Destreza", "weight-dex"],
        int: ["Inteligência", "weight-int"],
        def: ["Defesa", "weight-def"],
        agi: ["Agilidade", "weight-agi"]
    };
    const SKILL_LABELS = {
        str: "Força",
        dex: "Destreza",
        int: "Inteligência",
        def: "Defesa",
        agi: "Agilidade"
    };
    const ELEMENT_LABELS = {
        a: "Ar",
        e: "Terra",
        f: "Fogo",
        n: "Neutro",
        r: "Arco-íris",
        t: "Trovão",
        w: "Água"
    };
    const STAT_LABELS = {
        mr: "Mana Regen",
        ms: "Mana Steal",
        ls: "Life Steal",
        sdPct: "Spell Damage %",
        sdRaw: "Spell Damage Raw",
        mdPct: "Main Attack %",
        mdRaw: "Main Attack Raw",
        damPct: "Damage %",
        damRaw: "Damage Raw",
        hprPct: "Health Regen %",
        hprRaw: "Health Regen Raw",
        hp: "Health",
        hpBonus: "Health Bonus",
        maxMana: "Maximum Mana",
        spd: "Walk Speed",
        atkSpd: "Attack Speed",
        atkTier: "Attack Tier",
        averageDps: "Average DPS",
        slots: "Powder Slots",
        critDamPct: "Critical Damage %",
        healPct: "Healing Efficiency %",
        poison: "Poison",
        thorns: "Thorns",
        expd: "XP Bonus %",
        xpb: "XP Bonus",
        lb: "Loot Bonus %",
        jh: "Jump Height",
        kb: "Knockback",
        sprint: "Sprint",
        sprintReg: "Sprint Regen",
        slowEnemy: "Slow Enemy",
        weakenEnemy: "Weaken Enemy"
    };
    const ITEM_METADATA = new Set([
        "id", "name", "displayName", "category", "type", "tier", "lvl",
        "classReq", "drop", "lore", "remapID", "icon", "emblem", "elements",
        "quest", "ref", "restrict", "setName"
    ]);
    const CLASS_NAMES = {
        archer: "Archer",
        warrior: "Warrior",
        assassin: "Assassin",
        mage: "Mage",
        shaman: "Shaman"
    };
    const form = document.getElementById("build-form");
    const levelInput = document.getElementById("level");
    const classInput = document.getElementById("class-name");
    const submitButton = document.getElementById("optimize-button");
    const shareButton = document.getElementById("share-button");
    const dataStatus = document.getElementById("data-status");
    const formError = document.getElementById("form-error");
    const resultsContent = document.getElementById("results-content");
    let dataset = null;
    let lastConfig = null;
    let lastResult = null;

    function setError(message) {
        formError.textContent = message;
        formError.hidden = !message;
    }

    function updateSkillpointCap() {
        const points = WynnOptimizer.skillPointsAtLevel(levelInput.value);
        document.getElementById("skillpoint-cap").textContent =
            `${points} skill points disponíveis`;
    }

    function compatible(item, slot, level, className) {
        const isWeapon = slot === "weapon";
        const slotDefinition = isWeapon
            ? [WynnOptimizer.CLASS_WEAPONS[className], "weapon"]
            : WynnOptimizer.EQUIPMENT_SLOTS[SLOT_IDS.indexOf(slot)];
        return item.category === slotDefinition[1] &&
            item.type === slotDefinition[0] &&
            Number(item.lvl) <= level &&
            (!item.classReq || item.classReq === className);
    }

    function refreshDatalists(targetSlot) {
        if (!dataset) return;
        const level = Math.max(1, Math.min(121, Number(levelInput.value) || 1));
        const className = classInput.value;
        const slots = targetSlot ? [targetSlot] : SLOT_IDS;
        for (const slot of slots) {
            const list = document.getElementById(`items-${slot}`);
            const query = document.getElementById(`fixed-${slot}`).value.trim().toLocaleLowerCase();
            list.replaceChildren();
            if (!query) continue;
            const fragment = document.createDocumentFragment();
            const candidates = dataset.items.filter(item =>
                item.remapID === undefined &&
                typeof item.displayName === "string" &&
                typeof item.name === "string" &&
                item.displayName.toLocaleLowerCase().includes(query) &&
                compatible(item, slot, level, className)
            );
            candidates.sort((a, b) => a.displayName.localeCompare(b.displayName));
            for (const item of candidates.slice(0, 40)) {
                const option = document.createElement("option");
                option.value = item.displayName;
                option.label = `${item.displayName} · Nv. ${item.lvl} · ${item.tier || "Item"}`;
                fragment.append(option);
            }
            list.append(fragment);
        }
    }

    function getConfig() {
        const level = Number(levelInput.value);
        if (!Number.isInteger(level) || level < 1 || level > 121) {
            throw new Error("O nível precisa ser um número inteiro entre 1 e 121.");
        }
        const weights = {};
        for (const [stat, [, inputName]] of Object.entries(PRIORITIES)) {
            const input = form.elements.namedItem(inputName);
            const value = Number(input.value);
            if (!Number.isInteger(value) || value < 0 || value > 5) {
                throw new Error("Os pesos das prioridades devem ser números inteiros de 0 a 5.");
            }
            weights[stat] = (weights[stat] || 0) + value;
        }
        if (!Object.values(weights).some(weight => weight > 0)) {
            throw new Error("Escolha ao menos uma prioridade com peso maior que zero.");
        }
        const fixed = {};
        for (const slot of SLOT_IDS) {
            const id = slot === "ring1" || slot === "ring2" ? `fixed-${slot}` : `fixed-${slot}`;
            fixed[slot] = document.getElementById(id).value.trim();
        }
        return { className: classInput.value, level, fixed, weights };
    }

    function encodeConfig(config) {
        const bytes = new TextEncoder().encode(JSON.stringify(config));
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    }

    function decodeConfig(hash) {
        const match = hash.match(/^#b=([A-Za-z0-9_-]+)$/);
        if (!match) return null;
        const encoded = match[1].replaceAll("-", "+").replaceAll("_", "/");
        const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    }

    function applyConfig(config) {
        if (!config || !CLASS_NAMES[config.className] || !Number.isInteger(config.level)) {
            throw new Error("O link compartilhado contém uma configuração inválida.");
        }
        classInput.value = config.className;
        levelInput.value = String(config.level);
        for (const slot of SLOT_IDS) {
            document.getElementById(`fixed-${slot}`).value = config.fixed?.[slot] || "";
        }
        for (const [stat, [, inputName]] of Object.entries(PRIORITIES)) {
            const value = Number(config.weights?.[stat]) || 0;
            form.elements.namedItem(inputName).value = String(Math.max(0, Math.min(5, value)));
        }
        updateSkillpointCap();
    }

    function makeTag(text) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = text;
        return tag;
    }

    function statLabel(key) {
        if (STAT_LABELS[key]) return STAT_LABELS[key];
        const elementMatch = key.match(/^([aefnrtw])(Dam|Def|Md|Sd)(Pct|Raw)?$/);
        if (elementMatch) {
            const [, element, stat, modifier = ""] = elementMatch;
            const statName = stat === "Dam" ? "Damage" : stat === "Def" ? "Defense" :
                stat === "Md" ? "Main Attack" : "Spell Damage";
            const suffix = modifier === "Pct" ? " %" : modifier === "Raw" ? " Raw" : "";
            return `${ELEMENT_LABELS[element]} ${statName}${suffix}`;
        }
        const skillMatch = key.match(/^(str|dex|int|def|agi)(Req)?$/);
        if (skillMatch) {
            return skillMatch[2] ? `Requisito de ${SKILL_LABELS[skillMatch[1]]}` : SKILL_LABELS[skillMatch[1]];
        }
        if (/^(sd|md|dam|hpr)Pct$/.test(key)) return `${STAT_LABELS[key.slice(0, -3)]} %`;
        if (/^(sd|md|dam|hpr)Raw$/.test(key)) return `${STAT_LABELS[key.slice(0, -3)]} Raw`;
        const skillBonusMatch = key.match(/^sp(Pct|Raw)([1-4])$/);
        if (skillBonusMatch) {
            return `Skill Point Bonus${skillBonusMatch[1] === "Pct" ? " %" : " Raw"} ${skillBonusMatch[2]}`;
        }
        return key
            .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
            .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
            .replace(/Pct$/, "%")
            .replace(/Raw$/, "Raw")
            .replace(/^./, char => char.toLocaleUpperCase());
    }

    function formatStatValue(key, value) {
        if (typeof value === "number") {
            const sign = value > 0 ? "+" : "";
            const suffix = key.includes("Pct") || key === "expd" || key === "lb" ? "%" : "";
            return `${sign}${value}${suffix}`;
        }
        if (key === "atkTier" && value && typeof value === "object") {
            const raw = Number(value.raw) || 0;
            return `${raw > 0 ? "+" : ""}${raw}${value.static ? " (static)" : ""}`;
        }
        return String(value);
    }

    function renderStatGrid(stats) {
        const grid = document.createElement("dl");
        grid.className = "detail-stat-grid";
        const entries = Object.entries(stats)
            .filter(([key, value]) => {
                if (key === "illegal" || value === 0 || value === null || value === undefined) return false;
                if (ITEM_METADATA.has(key)) return false;
                if (key.endsWith("Req")) return false;
                return typeof value === "number" || typeof value === "string" ||
                    (key === "atkTier" && value && typeof value === "object");
            })
            .sort(([a], [b]) => statLabel(a).localeCompare(statLabel(b)));
        for (const [key, value] of entries) {
            const row = document.createElement("div");
            row.className = "detail-stat";
            const name = document.createElement("dt");
            name.textContent = statLabel(key);
            const amount = document.createElement("dd");
            amount.textContent = formatStatValue(key, value);
            row.append(name, amount);
            grid.append(row);
        }
        return grid;
    }

    function renderItemDetails(item, slot) {
        const section = document.createElement("section");
        section.className = "item-detail";
        const heading = document.createElement("div");
        heading.className = "item-detail-heading";
        const title = document.createElement("h4");
        title.textContent = `${SLOT_LABELS[slot]} · ${item.displayName}`;
        const tier = document.createElement("span");
        tier.textContent = `${item.tier || "Item"} · Nv. ${item.lvl}`;
        heading.append(title, tier);
        section.append(heading);

        const requirements = WynnOptimizer.SKILLS
            .filter(skill => Number(item[skill.req]) > 0)
            .map(skill => `${skill.label}: ${item[skill.req]}`);
        if (item.classReq) requirements.unshift(`Classe: ${CLASS_NAMES[item.classReq] || item.classReq}`);
        if (requirements.length) {
            const requirementNote = document.createElement("p");
            requirementNote.className = "item-requirements";
            requirementNote.textContent = `Requisitos: ${requirements.join(" · ")}`;
            section.append(requirementNote);
        }

        if (Array.isArray(item.elements) && item.elements.length) {
            const elements = document.createElement("p");
            elements.className = "item-elements";
            elements.textContent = `Elementos: ${item.elements.map(element =>
                ELEMENT_LABELS[{ air: "a", earth: "e", fire: "f", neutral: "n", rainbow: "r", thunder: "t", water: "w" }[element] || ""] || element
            ).join(", ")}`;
            section.append(elements);
        }

        const stats = renderStatGrid(item);
        if (stats.childElementCount) section.append(stats);
        if (typeof item.lore === "string" && item.lore) {
            const lore = document.createElement("p");
            lore.className = "item-lore";
            lore.textContent = item.lore;
            section.append(lore);
        }
        const tradability = document.createElement("p");
        const isTradable = WynnOptimizer.isTradable(item);
        tradability.className = `item-tradability${isTradable ? "" : " not-tradable"}`;
        tradability.textContent = isTradable ? "Tradable" : "Not tradable";
        section.append(tradability);
        return section;
    }

    function renderSetDetails(items) {
        const counts = new Map();
        for (const item of items) {
            if (item.setName) counts.set(item.setName, (counts.get(item.setName) || 0) + 1);
        }
        const activeSets = [...counts].filter(([name]) => dataset.sets[name]);
        if (!activeSets.length) return null;
        const section = document.createElement("section");
        section.className = "set-detail";
        const heading = document.createElement("h3");
        heading.textContent = "Bônus de conjunto";
        section.append(heading);
        for (const [name, count] of activeSets) {
            const set = dataset.sets[name];
            const bonus = set.bonuses?.[Math.min(count, set.bonuses.length) - 1] || {};
            const block = document.createElement("div");
            block.className = "set-bonus";
            const title = document.createElement("strong");
            title.textContent = `${name} · ${count} peça${count === 1 ? "" : "s"}`;
            block.append(title);
            const stats = renderStatGrid(bonus);
            if (stats.childElementCount) block.append(stats);
            else {
                const note = document.createElement("p");
                note.className = "item-requirements";
                note.textContent = "Sem bônus numérico ativo.";
                block.append(note);
            }
            section.append(block);
        }
        return section;
    }

    function renderResult(result, rank, config) {
        const card = document.createElement("article");
        card.className = `result-card${rank === 1 ? " best" : ""}`;

        const head = document.createElement("div");
        head.className = "result-card-head";
        const rankBlock = document.createElement("div");
        rankBlock.className = "result-rank";
        const number = document.createElement("span");
        number.className = "rank-number";
        number.textContent = String(rank);
        const title = document.createElement("strong");
        title.textContent = rank === 1 ? "Melhor combinação encontrada" : `Alternativa ${rank}`;
        rankBlock.append(number, title);
        const score = document.createElement("span");
        score.className = "result-score";
        score.textContent = `Score ${result.score.toFixed(2)}`;
        head.append(rankBlock, score);

        const grid = document.createElement("div");
        grid.className = "gear-result-grid";
        SLOT_IDS.forEach((slot, index) => {
            const box = document.createElement("div");
            box.className = "gear-result";
            const label = document.createElement("span");
            label.textContent = SLOT_LABELS[slot];
            const item = document.createElement("strong");
            item.textContent = result.items[index].displayName;
            item.title = `${result.items[index].displayName} · Nv. ${result.items[index].lvl} · ${result.items[index].tier || "Item"}`;
            box.append(label, item);
            grid.append(box);
        });

        const builderLink = document.createElement("a");
        builderLink.className = "button button-quiet result-builder-link";
        builderLink.href = WynnBuilderLink.createUrl(result.items, config.className, config.level);
        builderLink.target = "_blank";
        builderLink.rel = "noopener noreferrer";
        builderLink.textContent = "Abrir no WynnBuilder";

        const details = document.createElement("details");
        details.className = "result-details";
        const summary = document.createElement("summary");
        summary.textContent = "Abrir detalhes da build";
        const body = document.createElement("div");
        body.className = "result-body";

        const meta = document.createElement("div");
        meta.className = "result-meta";
        const skillBox = document.createElement("div");
        skillBox.className = "meta-box";
        const skillTitle = document.createElement("h3");
        skillTitle.textContent = "Pontos que você precisa distribuir";
        const skillList = document.createElement("div");
        skillList.className = "skill-list";
        WynnOptimizer.SKILLS.forEach((skill, index) =>
            skillList.append(makeTag(`${skill.label}: ${result.assigned[index]}`))
        );
        const pointsUsed = result.assigned.reduce((sum, points) => sum + points, 0);
        const pointNote = document.createElement("p");
        pointNote.className = "meta-note";
        pointNote.textContent = `${pointsUsed} de ${result.availablePoints} pontos usados; ${result.availablePoints - pointsUsed} livres.`;
        skillBox.append(skillTitle, skillList, pointNote);

        const orderBox = document.createElement("div");
        orderBox.className = "meta-box";
        const orderTitle = document.createElement("h3");
        orderTitle.textContent = "Ordem válida para equipar";
        const orderList = document.createElement("div");
        orderList.className = "order-list";
        result.equipOrder.forEach((item, index) =>
            orderList.append(makeTag(`${index + 1}. ${item.displayName}`))
        );
        orderBox.append(orderTitle, orderList);
        meta.append(skillBox, orderBox);

        const breakdown = document.createElement("div");
        breakdown.className = "breakdown";
        for (const [stat, [label]] of Object.entries(PRIORITIES)) {
            const weight = lastConfig.weights[stat];
            if (!weight) continue;
            const entry = document.createElement("div");
            const name = document.createElement("span");
            name.textContent = label;
            const value = document.createElement("strong");
            value.textContent = `${result.breakdown[stat] >= 0 ? "+" : ""}${result.breakdown[stat].toFixed(2)}`;
            entry.append(name, value);
            breakdown.append(entry);
        }
        const itemDetails = document.createElement("div");
        itemDetails.className = "item-detail-list";
        SLOT_IDS.forEach((slot, index) => itemDetails.append(renderItemDetails(result.items[index], slot)));
        const buildStats = document.createElement("section");
        buildStats.className = "build-stats";
        const buildStatsTitle = document.createElement("h3");
        buildStatsTitle.textContent = "Atributos totais da build";
        buildStats.append(buildStatsTitle, renderStatGrid(result.stats));
        body.append(meta, breakdown, buildStats);
        const setDetails = renderSetDetails(result.items);
        if (setDetails) body.append(setDetails);
        body.append(itemDetails);
        details.append(summary, body);
        card.append(head, grid, builderLink, details);
        return card;
    }

    function renderResults(search, config) {
        resultsContent.replaceChildren();
        lastResult = search.results[0] || null;
        const header = document.createElement("div");
        header.className = "results-header";
        const heading = document.createElement("div");
        const title = document.createElement("h2");
        title.textContent = "Builds recomendadas";
        const subtitle = document.createElement("p");
        subtitle.textContent = `${CLASS_NAMES[config.className]} · nível ${config.level} · ${search.availablePoints} skill points disponíveis`;
        heading.append(title, subtitle);
        header.append(heading);
        const list = document.createElement("div");
        list.className = "result-list";
        if (!search.results.length) {
            const empty = document.createElement("div");
            empty.className = "empty-result";
            const titleText = document.createElement("strong");
            titleText.textContent = "Não encontrei uma combinação válida entre os candidatos avaliados.";
            empty.append(titleText, document.createElement("br"));
            empty.append("Tente aumentar o nível, remover um item fixado ou reduzir os requisitos de skill points das peças.");
            list.append(empty);
        } else {
            search.results.forEach((result, index) =>
                list.append(renderResult(result, index + 1, config))
            );
        }
        const note = document.createElement("p");
        note.className = "method-note";
        note.textContent = `O validador procura uma ordem de equipagem, considera os bônus e penalidades de skill points, bônus de sets e limite de 100 pontos atribuídos por habilidade. Busca heurística sobre candidatos filtrados (até ${search.candidateCounts.join(" / ")} por espaço); não garante o ótimo global. O score considera IDs genéricos, não dano elemental específico, ciclo de spells nem DPS calculado.`;
        resultsContent.append(header, list, note);
        document.getElementById("results-section").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function runOptimization(event) {
        event.preventDefault();
        if (!dataset) return;
        setError("");
        submitButton.disabled = true;
        submitButton.querySelector("span:first-child").textContent = "Buscando combinações…";
        resultsContent.replaceChildren();
        try {
            const config = getConfig();
            lastConfig = config;
            const result = await WynnOptimizer.optimize(dataset, config);
            renderResults(result, config);
        } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
        } finally {
            submitButton.disabled = false;
            submitButton.querySelector("span:first-child").textContent = "Encontrar builds";
        }
    }

    async function shareBuild() {
        try {
            const config = lastResult && lastConfig
                ? {
                    ...lastConfig,
                    fixed: Object.fromEntries(SLOT_IDS.map((slot, index) =>
                        [slot, lastResult.items[index].displayName]
                    ))
                }
                : getConfig();
            const hash = `#b=${encodeConfig(config)}`;
            const link = `${window.location.origin}${window.location.pathname}${hash}`;
            await navigator.clipboard.writeText(link);
            shareButton.textContent = "Link copiado!";
            window.setTimeout(() => { shareButton.textContent = "Compartilhar build"; }, 1800);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível copiar o link.");
        }
    }

    async function loadData() {
        try {
            const response = await fetch("./data/items.json");
            if (!response.ok) throw new Error(`Falha ao carregar os itens (HTTP ${response.status}).`);
            dataset = await response.json();
            if (!Array.isArray(dataset.items) || !dataset.sets) {
                throw new Error("O arquivo local de dados está em um formato inesperado.");
            }
            const usableItems = dataset.items.filter(item =>
                item.remapID === undefined &&
                typeof item.displayName === "string" &&
                typeof item.name === "string"
            ).length;
            dataStatus.textContent = `${usableItems.toLocaleString("pt-BR")} itens prontos`;
            dataStatus.classList.add("ready");
            submitButton.disabled = false;
            shareButton.disabled = false;
            refreshDatalists();
            const shared = decodeConfig(window.location.hash);
            if (shared) applyConfig(shared);
        } catch (error) {
            dataStatus.textContent = "Falha ao carregar dados";
            dataStatus.classList.add("failed");
            setError(error instanceof Error ? error.message : String(error));
        }
    }

    form.addEventListener("submit", runOptimization);
    form.addEventListener("input", () => { lastResult = null; });
    form.addEventListener("change", () => { lastResult = null; });
    levelInput.addEventListener("input", () => {
        updateSkillpointCap();
        refreshDatalists();
    });
    classInput.addEventListener("change", refreshDatalists);
    for (const slot of SLOT_IDS) {
        document.getElementById(`fixed-${slot}`).addEventListener("input", () => refreshDatalists(slot));
    }
    shareButton.addEventListener("click", shareBuild);
    updateSkillpointCap();
    loadData();
})();
