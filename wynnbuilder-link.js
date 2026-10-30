(() => {
    const BASE_URL = "https://wynnbuilder.github.io/builder/";
    const ENCODING_VERSION = 35;
    const BASE64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";
    const EQUIPMENT_ORDER = [
        "helmet", "chestplate", "leggings", "boots",
        "ring1", "ring2", "bracelet", "necklace", "weapon"
    ];
    const POWDERABLE_SLOTS = new Set([0, 1, 2, 3, 8]);
    const WEAPON_CLASSES = {
        bow: "archer",
        spear: "warrior",
        dagger: "assassin",
        wand: "mage",
        relik: "shaman"
    };

    function appendBits(bits, value, width) {
        if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) {
            throw new RangeError(`Value ${value} does not fit in ${width} bits.`);
        }
        for (let shift = 0; shift < width; shift += 1) {
            bits.push((value >> shift) & 1);
        }
    }

    function encodeBits(bits) {
        const encoded = [];
        for (let index = 0; index < bits.length; index += 6) {
            let value = 0;
            for (let bit = 0; bit < 6; bit += 1) {
                value |= (bits[index + bit] || 0) << bit;
            }
            encoded.push(BASE64[value]);
        }
        return encoded.join("");
    }

    function encodeBuild(items, className, level) {
        if (!Array.isArray(items) || items.length !== EQUIPMENT_ORDER.length) {
            throw new TypeError("WynnBuilder links require eight equipment items and a weapon.");
        }
        if (!Number.isInteger(level) || level < 1 || level > 121) {
            throw new RangeError("Level must be an integer between 1 and 121.");
        }

        const weapon = items[8];
        if (!weapon || WEAPON_CLASSES[weapon.type] !== className) {
            throw new TypeError("The weapon type must match the selected class.");
        }

        const bits = [];
        appendBits(bits, 0xC, 6);
        appendBits(bits, ENCODING_VERSION, 10);

        items.forEach((item, index) => {
            if (!item || !Number.isInteger(item.id) || item.id < 0 || item.id >= 8191) {
                throw new TypeError(`Invalid WynnBuilder item ID in ${EQUIPMENT_ORDER[index]}.`);
            }
            appendBits(bits, 0, 2);
            appendBits(bits, item.id + 1, 13);
            if (POWDERABLE_SLOTS.has(index)) appendBits(bits, 0, 1);
        });

        appendBits(bits, 0, 1); // No tomes.
        appendBits(bits, 1, 1); // Let WynnBuilder assign skill points automatically.
        if (level === 121) {
            appendBits(bits, 0, 1);
        } else {
            appendBits(bits, 1, 1);
            appendBits(bits, level, 7);
        }
        appendBits(bits, 0, 1); // No aspects.

        return encodeBits(bits);
    }

    function createUrl(items, className, level) {
        return `${BASE_URL}#${encodeBuild(items, className, level)}`;
    }

    const api = { createUrl, encodeBuild };
    globalThis.WynnBuilderLink = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
