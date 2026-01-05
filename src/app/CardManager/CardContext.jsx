
'use client'

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { getAllCards } from '@/lib/server/cardio';

// Base shape keyed by cost bucket
const INITIAL_CARDS = { 'X': [], '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [], '10': [], '10+': [] };

const CardContext = createContext(null);

const ensureBucketedCopy = (state) => {
    // shallow copy buckets to preserve referential changes per cost
    const copy = {};
    for (const [key, arr] of Object.entries(INITIAL_CARDS)) {
        copy[key] = state?.[key] ? [...state[key]] : [];
    }
    return copy;
};

const bucketize = (cards = []) => {
    const next = ensureBucketedCopy(INITIAL_CARDS);
    for (const card of cards) {
        const bucket = card?.cost ?? 'X';
        if (!next[bucket]) next[bucket] = [];
        next[bucket] = [...next[bucket], card];
    }
    return next;
};

const cardReducer = (state, action) => {
    switch (action.type) {
        case 'ADD_CARD': {
            const next = ensureBucketedCopy(state);
            const card = action.payload;
            const bucket = card.cost ?? 'X';
            if (!next[bucket]) next[bucket] = [];
            next[bucket] = [...next[bucket], card];
            return next;
        }
        case 'ADD_CARDS': {
            const next = ensureBucketedCopy(state);
            for (const card of action.payload || []) {
                const bucket = card.cost ?? 'X';
                if (!next[bucket]) next[bucket] = [];
                next[bucket] = [...next[bucket], card];
            }
            return next;
        }
        case 'RESET': {
            return ensureBucketedCopy(action.payload || INITIAL_CARDS);
        }
        default:
            return state;
    }
};

export const CardProvider = ({ children, initialState = INITIAL_CARDS }) => {
    const [state, dispatch] = useReducer(cardReducer, initialState);

    const value = useMemo(() => ({ cards: state, dispatch }), [state]);

    // On first client render, hydrate from Dexie if available
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await getAllCards();
                if (mounted && Array.isArray(stored) && stored.length) {
                    dispatch(cardActions.reset(bucketize(stored)));
                }
            } catch (error) {
                console.error('Failed to hydrate cards from Dexie', error);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <CardContext.Provider value={value}>
            {children}
        </CardContext.Provider>
    );
};

export const useCards = () => {
    const ctx = useContext(CardContext);
    if (!ctx) {
        throw new Error('useCards must be used within a CardProvider');
    }
    return ctx;
};

export const cardActions = {
    addCard: (card) => ({ type: 'ADD_CARD', payload: card }),
    addCards: (cards) => ({ type: 'ADD_CARDS', payload: cards }),
    reset: (payload) => ({ type: 'RESET', payload })
};

// Utility exported for reuse if needed
export const bucketCards = bucketize;

export default CardContext;