const test = require("node:test");
const assert = require("node:assert/strict");
const optimizer = require("../optimizer.js");

function emptyItem(name) {
    return { name, displayName: name, str: 0, dex: 0, int: 0, def: 0, agi: 0 };
}

function emptyGear() {
    return Array.from({ length: 8 }, (_, index) => emptyItem(`gear-${index}`));
}

function makeWeapon() {
    return emptyItem("weapon");
}

test("skill points are capped at 200 and at level 121", () => {
    assert.equal(optimizer.skillPointsAtLevel(1), 0);
    assert.equal(optimizer.skillPointsAtLevel(31), 60);
    assert.equal(optimizer.skillPointsAtLevel(101), 200);
    assert.equal(optimizer.skillPointsAtLevel(121), 200);
});

test("items marked untradable or quest-only are not tradable", () => {
    assert.equal(optimizer.isTradable({ restrict: "untradable" }), false);
    assert.equal(optimizer.isTradable({ restrict: "quest_item" }), false);
    assert.equal(optimizer.isTradable({}), true);
});

test("a skill bonus on an item cannot satisfy that same item's equip requirement", () => {
    const gear = emptyGear();
    gear[2] = {
        ...emptyItem("calças"),
        str: 40,
        agiReq: 60
    };
    const plan = optimizer.findEquipPlan(gear, makeWeapon(), {}, 60);
    assert.ok(plan);
    assert.equal(plan.assigned[4], 60);
    assert.equal(plan.assigned.reduce((sum, value) => sum + value, 0), 60);
    assert.equal(plan.order.at(-1).name, "weapon");
});

test("the equip order uses a skill bonus to meet a later requirement", () => {
    const gear = emptyGear();
    gear[0] = { ...emptyItem("helmet"), str: 40, agiReq: 60 };
    gear[3] = { ...emptyItem("boots"), agi: 60, strReq: 40 };
    const plan = optimizer.findEquipPlan(gear, makeWeapon(), {}, 100);
    assert.ok(plan);
    assert.equal(plan.assigned.reduce((sum, value) => sum + value, 0), 40);
    assert.ok(plan.order.findIndex(item => item.name === "boots") <
        plan.order.findIndex(item => item.name === "helmet"));
});

test("a penalty cannot leave an equipped item's requirement unmet", () => {
    const gear = emptyGear();
    gear[0] = { ...emptyItem("helmet"), agi: -40, agiReq: 60 };
    const plan = optimizer.findEquipPlan(gear, makeWeapon(), {}, 60);
    assert.ok(plan);
    assert.equal(plan.assigned[4], 60);
});

test("set bonuses are included in build stats", () => {
    const gear = [
        { ...emptyItem("set-a"), setName: "Set" },
        { ...emptyItem("set-b"), setName: "Set" }
    ];
    const stats = optimizer.getBuildStats(gear, {
        Set: { bonuses: [{}, { mr: 4, str: 5 }] }
    });
    assert.equal(stats.mr, 4);
    assert.equal(stats.str, 5);
});

test("a set bonus can satisfy a later equipment requirement", () => {
    const gear = emptyGear();
    gear[0] = { ...emptyItem("set-a"), setName: "Set" };
    gear[1] = { ...emptyItem("set-b"), setName: "Set" };
    gear[2] = { ...emptyItem("needs-agility"), agiReq: 20 };
    const plan = optimizer.findEquipPlan(gear, makeWeapon(), {
        Set: { bonuses: [{}, { agi: 20 }] }
    }, 0);
    assert.ok(plan);
    assert.equal(plan.assigned.reduce((sum, value) => sum + value, 0), 0);
});

test("a build is rejected when its level cannot fund the requirements", () => {
    const gear = emptyGear();
    gear[0] = { ...emptyItem("helmet"), agiReq: 60 };
    assert.equal(optimizer.findEquipPlan(gear, makeWeapon(), {}, 58), null);
});
