const test = require("node:test");
const assert = require("node:assert/strict");
const { createUrl } = require("../wynnbuilder-link.js");

const equipment = [
    { id: 61, displayName: "Éther + Pó", type: "helmet" },
    { id: 126, displayName: "Aquarius", type: "chestplate" },
    { id: 4409, displayName: "Eutrophication", type: "leggings" },
    { id: 433, displayName: "Broken Balance", type: "boots" },
    { id: 1282, displayName: "Ring One", type: "ring" },
    { id: 1558, displayName: "Ring Two", type: "ring" },
    { id: 3237, displayName: "Bracelet", type: "bracelet" },
    { id: 1558, displayName: "Necklace", type: "necklace" },
    { id: 5054, displayName: "Wand", type: "wand" }
];

function readBits(encoded) {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";
    return [...encoded].flatMap(character => {
        const value = alphabet.indexOf(character);
        assert.notEqual(value, -1);
        return Array.from({ length: 6 }, (_, index) => (value >> index) & 1);
    });
}

function readValue(bits, state, width) {
    let value = 0;
    for (let index = 0; index < width; index += 1) {
        value |= bits[state.offset] << index;
        state.offset += 1;
    }
    return value;
}

test("build link uses WynnBuilder's current hash format with weapon class and ordered equipment", () => {
    const url = createUrl(equipment, "mage", 100);
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://wynnbuilder.github.io");
    assert.equal(parsed.pathname, "/builder/");
    assert.equal(parsed.search, "");

    const bits = readBits(parsed.hash.slice(1));
    const state = { offset: 0 };
    assert.equal(readValue(bits, state, 6), 12);
    assert.equal(readValue(bits, state, 10), 35);

    const powderableSlots = new Set([0, 1, 2, 3, 8]);
    equipment.forEach((item, index) => {
        assert.equal(readValue(bits, state, 2), 0);
        assert.equal(readValue(bits, state, 13) - 1, item.id);
        if (powderableSlots.has(index)) assert.equal(readValue(bits, state, 1), 0);
    });
    assert.equal(readValue(bits, state, 1), 0); // No tomes.
    assert.equal(readValue(bits, state, 1), 1); // Automatic skill points.
    assert.equal(readValue(bits, state, 1), 1); // Non-max level flag.
    assert.equal(readValue(bits, state, 7), 100);
    assert.equal(readValue(bits, state, 1), 0); // No aspects.
    assert.ok(bits.slice(state.offset).every(bit => bit === 0));
});

test("max level and reserved Base64 characters stay valid in the share hash", () => {
    const url = createUrl(equipment, "mage", 121);
    assert.match(url, /^https:\/\/wynnbuilder\.github\.io\/builder\/#C/);
    assert.ok(url.includes("+"));
    assert.ok(!url.includes("%2B"));
    assert.ok(!url.includes("Éther"));
    const bits = readBits(new URL(url).hash.slice(1));
    const state = { offset: 16 };
    for (let index = 0; index < equipment.length; index += 1) {
        readValue(bits, state, 2);
        readValue(bits, state, 13);
        if ([0, 1, 2, 3, 8].includes(index)) readValue(bits, state, 1);
    }
    readValue(bits, state, 1);
    readValue(bits, state, 1);
    assert.equal(readValue(bits, state, 1), 0);
});

test("invalid result shape, weapon class, level, and item IDs are rejected", () => {
    assert.throws(() => createUrl(equipment.slice(0, 8), "mage", 121), /eight equipment/);
    assert.throws(() => createUrl(equipment, "archer", 121), /weapon type/);
    assert.throws(() => createUrl(equipment, "mage", 0), /Level/);
    assert.throws(() => createUrl(equipment, "mage", 122), /Level/);
    const invalidId = equipment.map(item => ({ ...item }));
    invalidId[4].id = 8191;
    assert.throws(() => createUrl(invalidId, "mage", 121), /Invalid WynnBuilder item ID/);
});
