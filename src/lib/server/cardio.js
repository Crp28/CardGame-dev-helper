// Lightweight client-side data layer using Dexie (IndexedDB)
// to mimic DB CRUD for card data coming from the CardController.

import Dexie from 'dexie';
import pako from 'pako';

const DB_NAME = 'originTCG';
const CARD_STORE = 'cards';

let dbInstance;

/**
 * Lazily instantiate the Dexie database so we don't touch IndexedDB
 * during server-side rendering or build time.
 */
export const getDb = () => {
    if (!dbInstance) {
        if (typeof window === 'undefined') {
            throw new Error('cardio (Dexie) can only run in a browser context');
        }

        dbInstance = new Dexie(DB_NAME);
        dbInstance.version(1).stores({
            [CARD_STORE]: '++id,type,name,cost'
        });
        dbInstance.version(2).stores({
            // add affiliation index
            [CARD_STORE]: '++id,type,name,cost,affiliation'
        }).upgrade((tx) => {
            return tx.table(CARD_STORE).toCollection().modify((card) => {
                if (!card.affiliation) {
                    card.affiliation = [];
                }
            });
        });
        dbInstance.version(3).stores({
            // add decks table; list fields (cards/leaders/sideboard) stored as blobs, not indexed
            [CARD_STORE]: '++id,type,name,cost,affiliation',
            decks: '++id,name'
        });
    }

    return dbInstance;
};

const DEFAULT_CARD = {
    type: 'Follower',
    name: '',
    affiliation: [],
    description: '',
    cost: 'X',
    attack: '',
    life: '',
    phyRes: '',
    magRes: ''
};

const normalizeAffiliation = (affiliation) => {
    if (Array.isArray(affiliation)) {
        return affiliation.map((a) => String(a).trim()).filter(Boolean);
    }
    if (typeof affiliation === 'string') {
        return affiliation
            .split(/\s+/)
            .map((a) => a.trim())
            .filter(Boolean);
    }
    return [];
};

/** Normalize and coerce a single card payload for creation. */
const normalizeCard = (input = {}) => {
    const merged = { ...DEFAULT_CARD, ...input };
    const affiliation = normalizeAffiliation(input.affiliation ?? merged.affiliation);

    return {
        type: String(merged.type || 'Follower'),
        name: String(merged.name || '').trim(),
        affiliation,
        description: String(merged.description || ''),
        cost: String(merged.cost ?? 'X'),
        attack: merged.attack === undefined ? '' : String(merged.attack),
        life: merged.life === undefined ? '' : String(merged.life),
        phyRes: merged.phyRes === undefined ? '' : String(merged.phyRes),
        magRes: merged.magRes === undefined ? '' : String(merged.magRes)
    };
};

/** Sanitize a partial update without overriding unspecified fields. */
const sanitizePartialUpdate = (input = {}) => {
    const allowed = ['type', 'name', 'affiliation', 'description', 'cost', 'attack', 'life', 'phyRes', 'magRes'];
    const output = {};

    for (const key of allowed) {
        if (key in input) {
            const normalized = normalizeCard({ [key]: input[key] });
            output[key] = normalized[key];
        }
    }

    return output;
};

/**
 * Add a single card (from the single form).
 * @param {object} cardInput
 * @returns {Promise<{id: number} & typeof DEFAULT_CARD>}
 */
export const createCard = async (cardInput) => {
    const db = getDb();
    const card = normalizeCard(cardInput);
    const id = await db.table(CARD_STORE).add(card);
    return { id, ...card };
};

/**
 * Bulk add cards from a JSON string (for the bulk textarea).
 * Accepts either an array of card objects, a single card object,
 * or an object with a `cards` array property.
 * @param {string} jsonString
 * @returns {Promise<Array<{id: number} & typeof DEFAULT_CARD>>}
 */
export const createCardsFromJsonString = async (jsonString) => {
    const db = getDb();

    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch (error) {
        throw new Error('Invalid JSON supplied to bulk import');
    }

    const rawList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.cards)
            ? parsed.cards
            : [parsed];

    const cards = rawList.map(normalizeCard);
    const ids = await db.table(CARD_STORE).bulkAdd(cards, { allKeys: true });
    return cards.map((card, index) => ({ id: ids[index], ...card }));
};

/**
 * Read helpers
 */
export const getAllCards = async () => {
    const db = getDb();
    return db.table(CARD_STORE).toArray();
};

export const getCardById = async (id) => {
    const db = getDb();
    return db.table(CARD_STORE).get(id);
};

/**
 * Update a card by id with partial fields.
 * @param {number} id
 * @param {object} updates
 */
export const updateCard = async (id, updates) => {
    const db = getDb();
    const payload = sanitizePartialUpdate(updates);
    await db.table(CARD_STORE).update(id, payload);
    return db.table(CARD_STORE).get(id);
};

/** Delete a single card by id. */
export const deleteCard = async (id) => {
    const db = getDb();
    await db.table(CARD_STORE).delete(id);
};

/** Wipe all cards. Useful before imports. */
export const clearAllCards = async () => {
    const db = getDb();
    await db.table(CARD_STORE).clear();
};

/**
 * Export all stored cards to a compressed Base64 string.
 * Uses Gzip compression + Base64 encoding for compact sharing.
 * @returns {Promise<string>} Compressed Base64 string
 */
export const exportCardsToCompressedString = async () => {
    const cards = await getAllCards();
    const jsonString = JSON.stringify({ cards });

    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);

    // Compress using Gzip
    const compressed = pako.gzip(data);

    // Convert to Base64
    const base64 = btoa(String.fromCharCode(...compressed));

    return base64;
};

/**
 * Import cards from a compressed Base64 string.
 * Decompresses (Base64 → Gzip → JSON) and imports cards.
 * @param {string} compressedString Base64-encoded Gzip-compressed JSON
 * @param {{ replace?: boolean }} options
 * @returns {Promise<Array>} Imported cards
 */
export const importCardsFromCompressedString = async (compressedString, { replace = false } = {}) => {
    try {
        // Decode Base64
        const binaryString = atob(compressedString.trim());
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Decompress using Gzip
        const decompressed = pako.ungzip(bytes);

        // Convert back to string
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(decompressed);

        // Import the decompressed JSON
        if (replace) {
            await clearAllCards();
        }

        return createCardsFromJsonString(jsonString);
    } catch (error) {
        throw new Error('Failed to decompress or parse import data: ' + error.message);
    }
};

// Legacy JSON export/import kept for backward compatibility
export const exportCardsToJsonString = async (options = {}) => {
    const { pretty = true } = options;
    const cards = await getAllCards();
    return JSON.stringify({ cards }, null, pretty ? 2 : 0);
};

export const importCardsFromJsonString = async (jsonString, { replace = false } = {}) => {
    if (replace) {
        await clearAllCards();
    }
    return createCardsFromJsonString(jsonString);
};





