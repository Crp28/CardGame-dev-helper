
'use client'

import React, { useLayoutEffect, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { createCard, createCardsFromJsonString, updateCard, deleteCard as deleteCardFromDb, exportCardsToCompressedString, importCardsFromCompressedString } from '@/lib/server/cardio';
import { CardProvider, cardActions, useCards, bucketCards } from './CardContext';

// Force dynamic rendering to avoid SSR issues with IndexedDB
export const dynamic = 'force-dynamic';

const formatAffiliation = (affiliation = []) => affiliation.join(' ');

const BarGraph = ({ data }) => {
    const { cards } = useCards();
    const [selectedCost, setSelectedCost] = useState(null);
    const graphData = data ?? cards;

    // Convert flat array to bucketed format if needed
    const bucketedData = useMemo(() => {
        if (Array.isArray(graphData)) {
            // It's a flat array from filtering - bucket it
            return bucketCards(graphData);
        }
        // It's already in bucketed format
        return graphData;
    }, [graphData]);

    const sanitizedGraphData = useMemo(() => {
        if (!bucketedData || typeof bucketedData !== 'object') return {};
        return Object.entries(bucketedData).reduce((acc, [key, value]) => {
            if (key === '' || key == null) return acc;
            const bucket = (value || []).filter(card => card?.type !== 'Leader');
            if (!bucket.length) return acc;
            acc[key] = bucket;
            return acc;
        }, {});
    }, [bucketedData]);
    const costs = ['X', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '10+'];

    const barRefs = useRef({});
    const flipStateRef = useRef(null);
    const pieRef = useRef(null);
    const graphRef = useRef(null);
    const prevSelectedRef = useRef(null);

    useLayoutEffect(() => {
        gsap.registerPlugin(Flip);
    }, []);

    useLayoutEffect(() => {
        if (flipStateRef.current) {
            Flip.from(flipStateRef.current, {
                targets: '[data-flip-id^="bar-"]',
                duration: 0.65,
                ease: 'power2.inOut',
                absolute: true,
                nested: true,
            });
            flipStateRef.current = null;
        }

        if (selectedCost && pieRef.current) {
            gsap.fromTo(
                pieRef.current,
                { '--reveal': '0deg', opacity: 0, scale: 0.9 },
                { '--reveal': '360deg', opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }
            );
        }
    }, [selectedCost]);

    const maxbarheight = useMemo(
        () => Math.max(...Object.values(sanitizedGraphData).map(arr => (arr?.length ?? 0)), 0),
        [sanitizedGraphData]
    );

    const maxValue = Math.max(1, maxbarheight);
    const MAX_BAR_PX = 220;

    useLayoutEffect(() => {
        const wasFocused = prevSelectedRef.current !== null && prevSelectedRef.current !== undefined;
        if (!selectedCost && wasFocused && graphRef.current) {
            gsap.fromTo(
                graphRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.65, ease: 'power2.inOut' }
            );
        }
        prevSelectedRef.current = selectedCost;
    }, [selectedCost]);

    const pieSegments = useMemo(() => {
        if (!selectedCost) return null;
        const cardsAtCost = sanitizedGraphData[selectedCost] || [];
        const counts = cardsAtCost.reduce((acc, card) => {
            acc[card.type] = (acc[card.type] || 0) + 1;
            return acc;
        }, {});
        const total = cardsAtCost.length || 1;
        const palette = {
            Follower: '#fb7185',
            Leader: '#f59e0b',
            Legend: '#f43f5e',
            Castable: '#60a5fa',
            Environment: '#84cc16',
            Equipment: '#a855f7',
            Enchantment: '#14b8a6'
        };
        let current = 0;
        const segments = Object.entries(counts).map(([type, count]) => {
            const start = current;
            const angle = (count / total) * 360;
            const end = current + angle;
            current = end;
            return { type, start, end, color: palette[type] || '#9ca3af', count };
        });
        return segments;
    }, [sanitizedGraphData, selectedCost]);

    const pieStyle = pieSegments
        ? {
            backgroundImage: `conic-gradient(from 0deg, ${pieSegments
                .map(s => `${s.color} ${s.start}deg ${s.end}deg`)
                .join(', ')})`,
            maskImage: 'conic-gradient(from 0deg, #000 0deg var(--reveal, 360deg), transparent var(--reveal, 360deg) 360deg)',
            WebkitMaskImage: 'conic-gradient(from 0deg, #000 0deg var(--reveal, 360deg), transparent var(--reveal, 360deg) 360deg)',
            '--reveal': '360deg'
        }
        : {};

    const captureFlipState = () => {
        flipStateRef.current = Flip.getState('[data-flip-id^="bar-"]', { props: 'height,width' });
    };

    const handleBarClick = (index) => {
        const value = (sanitizedGraphData[index] || []).length;
        if (!value) return;
        captureFlipState();
        setSelectedCost(index);
    };

    const resetView = () => {
        captureFlipState();
        setSelectedCost(null);
    };

    const getBarHeight = (value) => {
        return Math.max((value / maxValue) * MAX_BAR_PX, 8);
    };

    if (selectedCost) {
        const count = sanitizedGraphData[selectedCost]?.length || 0;
        const barHeight = getBarHeight(count);

        return (
            <div className="w-full h-full flex flex-col justify-between px-4 pt-4" onClick={resetView}>
                <div className="flex flex-1 gap-6">
                    {/* Focused bar */}
                    <div
                        className="flex-1 flex flex-col items-center justify-end"
                    >
                        <div
                            ref={(el) => {
                                if (el) barRefs.current[selectedCost] = el;
                            }}
                            data-flip-id={`bar-${selectedCost}`}
                            className="flex flex-col items-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-xs text-blue-500 mb-1 font-mono">{count}</div>
                            <div
                                className="w-16 bg-zinc-300 rounded-t-md text-center"
                                style={{ height: `${barHeight}px` }}
                            />
                        </div>
                        <div className="text-sm text-gray-700 mb-8 mt-2 font-mono">Cost {selectedCost}</div>
                    </div>

                    {/* Pie chart */}
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div
                            ref={pieRef}
                            className="w-40 h-40 rounded-full border border-gray-200 shadow-inner"
                            style={pieStyle}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="mt-3 flex flex-col gap-1 w-full px-4">
                            {pieSegments?.map(seg => (
                                <div key={seg.type} className="flex items-center justify-between text-xs font-mono text-gray-700">
                                    <span className="flex items-center gap-2">
                                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
                                        {seg.type}
                                    </span>
                                    <span>{seg.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={graphRef} className="w-full h-full flex flex-col justify-end px-4 pt-4">
            {/* Graph area */}
            <div className="flex items-end justify-around h-full gap-1">
                {costs.map((index) => {
                    const value = (sanitizedGraphData[index] || []).length;
                    const heightPx = getBarHeight(value);
                    const clickable = value > 0;
                    return (
                        <button
                            key={index}
                            type="button"
                            disabled={!clickable}
                            onClick={() => handleBarClick(index)}
                            className={`flex flex-col items-center flex-1 h-full justify-end focus:outline-none ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <div
                                ref={(el) => {
                                    if (el) barRefs.current[index] = el;
                                }}
                                data-flip-id={`bar-${index}`}
                                className="flex flex-col items-center w-full"
                            >
                                <div className="text-xs text-blue-300 mb-1 font-mono">
                                    {value}
                                </div>
                                <div
                                    className={`w-full rounded-t-md ${clickable ? 'bg-zinc-300 hover:bg-zinc-200' : 'bg-zinc-300'}`}
                                    style={{
                                        height: `${heightPx}px`
                                    }}
                                />
                            </div>
                            {/* X-axis label */}
                            <div className="text-xs text-gray-600 mt-2 font-mono">
                                {index}
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className='mx-auto font-mono text-gray-800 pb-2 pt-1'>Costs</div>
        </div>
    );
};

const CardController = () => {
    const [activeTab, setActiveTab] = useState(0);
    const { dispatch } = useCards();

    // Form state for Single tab
    const [singleFormData, setSingleFormData] = useState({
        type: 'Follower',
        name: '',
        affiliation: '',
        description: '',
        cost: '',
        attack: '',
        life: '',
        phyRes: '',
        magRes: ''
    });

    // Form state for Bulk tab
    const [bulkFormData, setBulkFormData] = useState({
        cards: ''
    });

    const handleSingleInputChange = (e) => {
        const { name, value } = e.target;
        setSingleFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleBulkInputChange = (e) => {
        setBulkFormData({
            cards: e.target.value
        });
    };

    const parseAffiliation = (value) => {
        if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
        if (typeof value === 'string') return value.split(/\s+/).map((v) => v.trim()).filter(Boolean);
        return [];
    };

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...singleFormData,
                affiliation: parseAffiliation(singleFormData.affiliation)
            };
            const saved = await createCard(payload);
            dispatch(cardActions.addCard(saved));
            console.log('Saved card:', saved);
            alert('Card saved locally.');
            setSingleFormData({
                type: 'Follower',
                name: '',
                affiliation: '',
                description: '',
                cost: 'X',
                attack: '',
                life: '',
                phyRes: '',
                magRes: ''
            });
        } catch (error) {
            console.error('Failed to save card', error);
            alert('Failed to save card. Check console for details.');
        }
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        try {
            const saved = await createCardsFromJsonString(bulkFormData.cards);
            dispatch(cardActions.addCards(saved));
            console.log('Bulk saved cards:', saved);
            alert(`Saved ${saved.length} cards locally.`);
            setBulkFormData({ cards: '' });
        } catch (error) {
            console.error('Failed bulk import', error);
            alert('Failed to import. Ensure valid JSON.');
        }
    };

    return (
        <div className="w-full h-full flex">
            {/* Vertical Tabs on Left */}
            <div className="flex flex-col">
                <button
                    onClick={() => setActiveTab(0)}
                    className={`flex-1 font-mono text-sm transition-all duration-300 border-r-2 size-10 ${activeTab === 0
                        ? 'border-red-300 text-red-400'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                >
                    <div className='-rotate-90 whitespace-nowrap tracking-widest'>Single</div>
                </button>
                <div className="h-px bg-gray-200 my-2"></div>
                <button
                    onClick={() => setActiveTab(1)}
                    className={`flex-1 font-mono text-sm transition-all duration-300 border-r-2 size-10 ${activeTab === 1
                        ? 'border-red-300 text-red-400'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                >
                    <div className='-rotate-90 whitespace-nowrap tracking-widest'>Bulk</div>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col justify-center ml-4 text-black">
                {activeTab === 0 ? (
                    // First Tab Content - Single Form
                    <form onSubmit={handleSingleSubmit} className="flex flex-col gap-2">
                        <div className="flex flex-col">
                            <label className="font-mono text-sm text-gray-600 mb-1">
                                Type
                            </label>
                            <select
                                name="type"
                                value={singleFormData.type}
                                onChange={handleSingleInputChange}
                                className='w-full border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors'
                            >
                                <option value="Follower">Follower</option>
                                <option value="Leader">Leader</option>
                                <option value="Castable">Castable</option>
                                <option value="Enchantment">Enchantment</option>
                                <option value="Environment">Environment</option>
                                <option value="Legend">Legend</option>
                                <option value="Equipment">Equipment</option>
                            </select>
                        </div>
                        {singleFormData.type === "Follower" || singleFormData.type === "Legend" ? <div className="flex flex-row gap-4">
                            <div className="flex flex-col">
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={singleFormData.name}
                                    onChange={handleSingleInputChange}
                                    className="border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors"
                                    placeholder="Name"
                                    required
                                />
                            </div>
                            <div className="flex flex-col">
                                {/* Affiliations separated by space, e.g., "Naria Human Warrior", each is stored separately in the affiliation array */}
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Affiliation
                                </label>
                                <input
                                    type="text"
                                    name="affiliation"
                                    value={singleFormData.affiliation}
                                    onChange={handleSingleInputChange}
                                    className="border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors"
                                    placeholder="Affiliation"

                                />
                            </div>
                        </div> : <div className="flex flex-col">
                            <label className="font-mono text-sm text-gray-600 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={singleFormData.name}
                                onChange={handleSingleInputChange}
                                className="border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors"
                                placeholder="Name"
                                required
                            />
                        </div>}
                        <div className="flex flex-col">
                            <label className="font-mono text-sm text-gray-600 mb-1">
                                Description
                            </label>
                            <textarea
                                name="description"
                                value={singleFormData.description}
                                onChange={handleSingleInputChange}
                                rows="1"
                                className="border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors text-wrap resize-none"
                                placeholder="Card effects"
                            />
                        </div>
                        <div className="flex flex-row gap-4">
                            {singleFormData.type !== "Leader" ? <div className='flex-1 flex flex-col min-w-0'>
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Cost
                                </label>
                                <select
                                    name="cost"
                                    value={singleFormData.cost}
                                    onChange={handleSingleInputChange}
                                    className='w-full border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors'
                                >
                                    <option value="X">X</option>
                                    <option value="0">0</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                    <option value="6">6</option>
                                    <option value="7">7</option>
                                    <option value="8">8</option>
                                    <option value="9">9</option>
                                    <option value="10">10</option>
                                    <option value="10+">10+</option>
                                </select>
                            </div> : <></>}
                            {singleFormData.type === "Follower" || singleFormData.type === "Equipment" ? <div className='flex-1 flex flex-col min-w-0'>
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Attack
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    name="attack"
                                    value={singleFormData.attack}
                                    onChange={handleSingleInputChange}
                                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors"
                                    placeholder="0"
                                    defaultValue='0'
                                />
                            </div> : <></>}
                            {singleFormData.type === "Legend" ? <div className='flex-1 flex flex-col min-w-0'>
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Power
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    name="attack"
                                    value={singleFormData.attack}
                                    onChange={handleSingleInputChange}
                                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors"
                                    placeholder="0"
                                    defaultValue='0'
                                />
                            </div> : <></>}
                            {singleFormData.type === "Follower" || singleFormData.type === "Legend" || singleFormData.type === "Equipment" || singleFormData.type === "Leader" ? <div className='flex-1 flex flex-col min-w-0'>
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Life
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    name="life"
                                    value={singleFormData.life}
                                    onChange={handleSingleInputChange}
                                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus: outline-none focus:border-red-300 transition-colors"
                                    placeholder="0"
                                    defaultValue='0'
                                />
                            </div> : <></>}
                            {singleFormData.type === "Follower" || singleFormData.type === "Legend" || singleFormData.type === "Leader" ? <div className='flex-1 flex flex-col min-w-0'>
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Phy Res
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    name="phyRes"
                                    value={singleFormData.phyRes}
                                    onChange={handleSingleInputChange}
                                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors"
                                    placeholder="0"
                                    defaultValue='0'
                                />
                            </div> : <></>}
                            {singleFormData.type === "Follower" || singleFormData.type === "Legend" || singleFormData.type === "Leader" ? <div className='flex-1 flex flex-col min-w-0'>
                                <label className="font-mono text-sm text-gray-600 mb-1">
                                    Mag Res
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    name="magRes"
                                    value={singleFormData.magRes}
                                    onChange={handleSingleInputChange}
                                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors"
                                    placeholder="0"
                                    defaultValue='0'
                                />
                            </div> : <></>}
                        </div>
                        <button
                            type="submit"
                            className="mt-2 bg-red-400 hover:bg-red-500 text-white font-mono text-sm py-2 px-4 rounded-lg transition-colors"
                        >
                            Submit Card
                        </button>
                    </form>
                ) : (
                    // Second Tab Content - Bulk Form
                    <form onSubmit={handleBulkSubmit} className="flex flex-col h-full">
                        <div className="flex flex-col p-4 flex-1">
                            <label className="font-mono text-sm text-gray-600 mb-1">
                                Enter cards in JSON format
                            </label>
                            <textarea
                                name="cards"
                                value={bulkFormData.cards}
                                onChange={handleBulkInputChange}
                                className="flex-1 border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-red-300 transition-colors resize-none"
                                placeholder="{
                                    }"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="mt-4 bg-red-400 hover:bg-red-500 text-white font-mono text-sm py-2 px-4 rounded-lg transition-colors"
                        >
                            Submit Bulk
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// const cardThumbnail = (card) => {
//     return (
//         // border colour reflects card type
//         <>
//             {card.type === 'Environment' ? <div className='flex w-full border-2 border-lime-300  hover:bg-lime-50 transition-transform rounded-lg px-3' >
//                 <p className='text-blue-400 mr-6 max-w-2'><b>{card.cost}</b></p>
//                 <p className='font-mono text-gray-800'><b>{card.name}</b></p>
//             </div> : <></>}
//             {card.type === 'Castable' ? <div className='flex w-full border-2 border-blue-300/90  hover:bg-blue-50 transition-transform rounded-lg px-3' >
//                 <p className='text-blue-400 mr-6 max-w-2'><b>{card.cost}</b></p>
//                 <p className='font-mono text-gray-800'><b>{card.name}</b></p>
//             </div> : <></>}
//             {card.type === 'Follower' ? <div className='flex w-full border-2 border-pink-300 hover:bg-pink-50 transition-transform rounded-lg px-3' >
//                 <p className='text-blue-400 mr-6 max-w-2'><b>{card.cost}</b></p>
//                 <p className='font-mono text-gray-800'><b>{card.name}</b></p>
//             </div> : <></>}
//             {card.type === 'Leader' ? <div className='flex w-full border-2 border-amber-400  hover:bg-amber-50 transition-transform rounded-lg px-3' >
//                 <p className='text-blue-400 mr-6 max-w-2'><b>⭐️</b></p>
//                 <p className='font-mono text-gray-800'><b>{card.name}</b></p>
//             </div> : <></>}
//             {card.type === 'Equipment' ? <div className='flex w-full border-2 border-purple-400 hover:bg-violet-50 transition-transform rounded-lg px-3' >
//                 <p className='text-blue-400 mr-6 max-w-2'><b>{card.cost}</b></p>
//                 <p className='font-mono text-gray-800'><b>{card.name}</b></p>
//             </div> : <></>}
//             {card.type === 'Enchantment' ? <div className='flex w-full border-2 border-teal-400 hover:bg-teal-50 transition-transform rounded-lg px-3' >
//                 <p className='text-blue-400 mr-6 max-w-2'><b>{card.cost}</b></p>
//                 <p className='font-mono text-gray-800'><b>{card.name}</b></p>
//             </div> : <></>}
//             {card.type === 'Legend' ? <div className='flex w-full border-2 border-rose-500/80 hover:bg-rose-50 transition-transform rounded-lg px-3' >
//                 <p className='text-blue-400 mr-6 max-w-2'><b>{card.cost}</b></p>
//                 <p className='font-mono text-gray-800'><b>{card.name}</b></p>
//             </div> : <></>}
//         </>
//     )
// }

// const CardList = () => {
//     const { cards } = useCards();

//     const allCards = Object.values(cards).flat();
//     return (
//         <div className="w-full h-full overflow-y-auto p-1 select-none">

//             {allCards.map((card) => (
//                 <div key={card.id} className="mb-0.5 hover:scale-[101%] transition-transform cursor-pointer">
//                     {cardThumbnail(card)}
//                 </div>
//             ))}

//         </div>
//     );
// }

const CardList = ({ onSelect, selectedId, filteredCards, sortBy, sortOrder }) => {
    const allCards = useMemo(() => {
        let result = filteredCards || [];

        // Sort
        if (sortBy === 'id') {
            result = [...result].sort((a, b) => {
                return sortOrder === 'asc' ? (a.id - b.id) : (b.id - a.id);
            });
        } else if (sortBy === 'type') {
            result = [...result].sort((a, b) => {
                const cmp = a.type.localeCompare(b.type);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else if (sortBy === 'cost') {
            const costOrder = ['X', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '10+', ''];
            result = [...result].sort((a, b) => {
                const aIndex = costOrder.indexOf(a.cost ?? '');
                const bIndex = costOrder.indexOf(b.cost ?? '');
                const cmp = aIndex - bIndex;
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [filteredCards, sortBy, sortOrder]);

    if (!allCards.length) {
        return <p className="font-mono text-sm text-gray-400">No cards match</p>;
    }

    return (
        <div
            className="w-full h-full flex-1 min-h-0 overflow-y-scroll p-1 select-none flex flex-col gap-1"
            style={{ scrollbarGutter: 'stable' }}
        >
            {allCards.map((card) => {
                const isSelected = selectedId === card.id;
                const borderByType = {
                    Environment: 'border-lime-300 hover:bg-lime-50',
                    Castable: 'border-blue-300/90 hover:bg-blue-50',
                    Follower: 'border-pink-300 hover:bg-pink-50',
                    Leader: 'border-amber-400 hover:bg-amber-50',
                    Equipment: 'border-purple-400 hover:bg-violet-50',
                    Enchantment: 'border-teal-400 hover:bg-teal-50',
                    Legend: 'border-rose-500/80 hover:bg-rose-50'
                };
                const selectedBackground = {
                    Environment: 'bg-lime-100',
                    Castable: 'bg-blue-100',
                    Follower: 'bg-pink-100',
                    Leader: 'bg-amber-100',
                    Equipment: 'bg-violet-100',
                    Enchantment: 'bg-teal-100',
                    Legend: 'bg-rose-100'
                }

                return (
                    <button
                        key={card.id ?? `${card.name}-${card.cost}`}
                        onClick={() => onSelect?.(card)}
                        className={`flex w-full border-2 rounded-lg px-3 py-2 text-left transition-all hover:cursor-pointer hover:scale-[1.01] ${borderByType[card.type]} ${isSelected ? selectedBackground[card.type] : ''}`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <span className="text-blue-500 font-mono text-sm min-w-6">{card.type === 'Leader' ? '⭐' : card.cost}</span>
                                <div className="flex flex-col">
                                    <span className="font-mono text-sm text-gray-800 font-semibold">{card.name || 'Untitled'}</span>
                                    <span className="font-mono text-[11px] text-gray-500 truncate">{formatAffiliation(card.affiliation)}</span>
                                </div>
                            </div>

                        </div>
                    </button>
                );
            })}
        </div>
    );
};

const CardShow = ({ id, name, type, cost, affiliation, description, attack, life, phyRes, magRes, onUpdate, onDelete }) => {
    const [editMode, setEditMode] = useState(null); // field name being edited
    const [editValue, setEditValue] = useState('');

    const handleDoubleClick = (field, currentValue) => {
        setEditMode(field);
        setEditValue(Array.isArray(currentValue) ? currentValue.join(' ') : String(currentValue || ''));
    };

    const handleSave = async () => {
        if (!editMode) return;

        try {
            let valueToSave = editValue;
            // If editing affiliation, split into array
            if (editMode === 'affiliation') {
                valueToSave = editValue.split(' ').filter(s => s.trim());
            }
            const updates = { [editMode]: valueToSave };
            await onUpdate(id, updates);
            setEditMode(null);
            setEditValue('');
        } catch (error) {
            console.error('Failed to update card', error);
            alert('Failed to update card');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditMode(null);
            setEditValue('');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete card "${name}"?`)) return;

        try {
            await onDelete(id);
        } catch (error) {
            console.error('Failed to delete card', error);
            alert('Failed to delete card');
        }
    };

    const renderEditableField = (field, value, label) => {
        const isEditing = editMode === field;
        const displayValue = Array.isArray(value) ? value.join(' ') : String(value || '');

        return (
            <div className="flex items-center gap-2">
                {field !== "affiliation" ? <span className="font-semibold">{label}:</span> : null}
                {isEditing ? (
                    <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="flex-1 border-2 border-red-300 rounded px-2 py-1 text-sm font-mono focus:outline-none"
                    />
                ) : (
                    <span
                        onDoubleClick={() => handleDoubleClick(field, value)}
                        className={field === "affiliation" ? "cursor-pointer hover:bg-gray-100 rounded ml-2 text-[12px] font-mono text-gray-700" : "flex-1 cursor-pointer hover:bg-gray-100 rounded px-2 py-1"}
                        title="Double-click to edit"
                    >
                        {displayValue || <span className="text-gray-400 italic">-</span>}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col gap-3 text-gray-800">
            {/* Header with cost/type badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-blue-500 font-mono text-2xl min-w-6">
                        {type === 'Leader' ? '⭐' : cost}
                    </span>
                    <div className="flex flex-col">
                        {editMode === 'name' ? (
                            <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleSave}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="border-2 border-red-300 rounded px-2 py-1 text-lg font-mono font-semibold focus:outline-none"
                            />
                        ) : (
                            <span
                                className="font-mono text-lg font-semibold cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
                                onDoubleClick={() => handleDoubleClick('name', name)}
                                title="Double-click to edit"
                            >
                                {name || <span className="text-gray-400 italic">Untitled</span>}
                            </span>
                        )}
                        <span className="font-mono text-xs text-gray-500 px-2">{type}</span>
                        {/* Affiliation */}
                        {(affiliation?.length > 0 || editMode === 'affiliation') && (
                            <div className="text-sm">
                                {renderEditableField('affiliation', affiliation, 'Affiliation')}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleDelete}
                    className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors hover:cursor-pointer"
                    title="Delete this card"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </button>

            </div>



            {/* Description */}
            {(description || editMode === 'description') && (
                <div className="text-sm">
                    {editMode === 'description' ? (
                        <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setEditMode(null);
                                    setEditValue('');
                                }
                            }}
                            autoFocus
                            rows={4}
                            className="w-full border-2 border-red-300 rounded px-2 py-1 text-sm font-mono focus:outline-none resize-none"
                        />
                    ) : (
                        <pre
                            className="font-mono text-sm text-gray-700 leading-snug text-wrap cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
                            onDoubleClick={() => handleDoubleClick('description', description)}
                            title="Double-click to edit"
                        >
                            {description}
                        </pre>
                    )}
                </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 text-sm font-mono text-gray-600 mt-2">
                {attack != null && renderEditableField('attack', attack, 'ATK')}
                {life != null && renderEditableField('life', life, 'LIFE')}
                {phyRes != null && renderEditableField('phyRes', phyRes, 'PHY RES')}
                {magRes != null && renderEditableField('magRes', magRes, 'MAG RES')}
            </div>
        </div>
    );
};

const ControlPanel = ({ onFilterChange, onSortChange, onExport, onImport }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [filterTypes, setFilterTypes] = useState([]);
    const [filterCosts, setFilterCosts] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState('cost');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [exportString, setExportString] = useState('');
    const [importString, setImportString] = useState('');

    const cardTypes = ['Follower', 'Leader', 'Legend', 'Castable', 'Environment', 'Equipment', 'Enchantment'];
    const costs = ['X', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '10+'];

    useEffect(() => {
        onFilterChange({ types: filterTypes, costs: filterCosts, searchText });
    }, [filterTypes, filterCosts, searchText, onFilterChange]);

    useEffect(() => {
        onSortChange({ sortBy, sortOrder });
    }, [sortBy, sortOrder, onSortChange]);

    const toggleType = (type) => {
        setFilterTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const toggleCost = (cost) => {
        setFilterCosts(prev =>
            prev.includes(cost) ? prev.filter(c => c !== cost) : [...prev, cost]
        );
    };

    const toggleSort = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const handleExportClick = async () => {
        try {
            const compressedString = await onExport();
            setExportString(compressedString);
            setShowExportModal(true);
        } catch (error) {
            console.error('Export failed', error);
            alert('Export failed: ' + error.message);
        }
    };

    const handleImportClick = () => {
        setImportString('');
        setShowImportModal(true);
    };

    const handleImportSubmit = async () => {
        if (!importString.trim()) {
            alert('Please enter a valid import string');
            return;
        }

        try {
            const replace = window.confirm('Replace existing cards? (Cancel to append)');
            await onImport(importString, { replace });
            setShowImportModal(false);
            setImportString('');
            alert('Import successful!');
        } catch (error) {
            console.error('Import failed', error);
            alert('Import failed: ' + error.message);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(exportString);
        alert('Copied to clipboard!');
    };

    return (
        <div className="w-[40%] mx-auto mb-6 rounded-3xl bg-white  relative">
            <div className="flex items-center justify-between px-4 py-1 gap-4">
                <div className="flex items-center gap-3">
                    {/* Filter button */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-lg transition-colors hover:cursor-pointer ${showFilters ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                        title="Filter cards"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                        </svg>
                    </button>

                    {/* Sort controls */}
                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="text-sm text-gray-600 font-mono text-center bg-transparent border-none focus:outline-none cursor-pointer appearance-none"
                        >
                            <option value="cost">Cost</option>
                            <option value="type">Type</option>
                            <option value="id">Created</option>
                        </select>
                        <button
                            onClick={toggleSort}
                            className="text-gray-600 hover:text-gray-800 hover:cursor-pointer transition-colors"
                            title={`Click to sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                        >
                            {sortOrder === 'asc' ? <svg xmlns="http://www.w3.org/2000/svg" className='w-5 h-5' s viewBox="0 0 20 20"><title>Sort-descending</title><path fill="currentColor" d="M3 3a1 1 0 0 0 0 2h11a1 1 0 1 0 0-2zm0 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2zm0 4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zm12-3a1 1 0 1 0-2 0v5.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 0-1.414-1.414L15 13.586z" /></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" className='w-5 h-5' viewBox="0 0 20 20"><title>Sort-ascending</title><path fill="currentColor" d="M3 3a1 1 0 0 0 0 2h11a1 1 0 1 0 0-2zm0 4a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2zm0 4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zm10 5a1 1 0 1 0 2 0v-5.586l1.293 1.293a1 1 0 0 0 1.414-1.414l-3-3a1 1 0 0 0-1.414 0l-3 3a1 1 0 1 0 1.414 1.414L13 10.414z" /></svg>}
                        </button>
                    </div>
                </div>

                {/* Export/Import buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleImportClick}
                        className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-mono transition-colors"
                        title="Import cards from JSON file"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        Import
                    </button>
                    <button
                        onClick={handleExportClick}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-mono transition-colors"
                        title="Export cards to JSON file"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Export
                    </button>
                </div>
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setShowExportModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-mono font-bold mb-4 text-gray-800">Export Cards</h2>
                        <p className="text-sm font-mono text-gray-600 mb-3">Copy this import string to share or backup your cards:</p>
                        <textarea
                            value={exportString}
                            readOnly
                            rows={8}
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 bg-gray-50 text-gray-800"
                            onClick={(e) => e.target.select()}
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={copyToClipboard}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-mono text-sm py-2 px-4 rounded-lg transition-colors"
                            >
                                Copy to Clipboard
                            </button>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-mono text-sm py-2 px-4 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setShowImportModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-mono font-bold mb-4 text-gray-800">Import Cards</h2>
                        <p className="text-sm font-mono text-gray-600 mb-3">Paste an import string below:</p>
                        <textarea
                            value={importString}
                            onChange={(e) => setImportString(e.target.value)}
                            rows={8}
                            placeholder="Paste compressed card data here..."
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 text-gray-800"
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleImportSubmit}
                                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-mono text-sm py-2 px-4 rounded-lg transition-colors"
                            >
                                Import
                            </button>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-mono text-sm py-2 px-4 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter panel (absolutely positioned, overlays content) */}
            {showFilters && (
                <div className="absolute left-0 top-full w-full z-50 border-2 border-gray-300 bg-white rounded-b-3xl shadow-xl p-4 space-y-4" style={{ minWidth: '320px' }}>
                    {/* Search text */}
                    <div>
                        <label className="block text-sm font-mono text-gray-600 mb-2">Search (name, description, affiliation)</label>
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
                        />
                    </div>

                    {/* Type filters */}
                    <div>
                        <label className="block text-sm font-mono text-gray-600 mb-2">Card Types</label>
                        <div className="flex flex-wrap gap-2">
                            {cardTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => toggleType(type)}
                                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${filterTypes.includes(type)
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cost filters */}
                    <div>
                        <label className="block text-sm font-mono text-gray-600 mb-2">Costs</label>
                        <div className="flex flex-wrap gap-2">
                            {costs.map(cost => (
                                <button
                                    key={cost}
                                    onClick={() => toggleCost(cost)}
                                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${filterCosts.includes(cost)
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    {cost}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Clear filters */}
                    {(filterTypes.length > 0 || filterCosts.length > 0 || searchText) && (
                        <button
                            onClick={() => {
                                setFilterTypes([]);
                                setFilterCosts([]);
                                setSearchText('');
                            }}
                            className="text-sm text-red-600 hover:text-red-800 font-mono"
                        >
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const CardManagerContent = () => {
    const { cards, dispatch } = useCards();
    const [selectedCard, setSelectedCard] = useState(null);

    // Filter and sort state
    const [filterTypes, setFilterTypes] = useState([]);
    const [filterCosts, setFilterCosts] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState('cost');
    const [sortOrder, setSortOrder] = useState('asc');

    // Flatten cards from buckets
    const allCards = useMemo(() => {
        const flattened = [];
        if (cards && typeof cards === 'object') {
            Object.values(cards).forEach(bucket => {
                if (Array.isArray(bucket)) {
                    flattened.push(...bucket);
                }
            });
        }
        return flattened;
    }, [cards]);

    // Apply filters
    const filteredCards = useMemo(() => {
        return allCards.filter(card => {
            // Type filter
            if (filterTypes.length > 0 && !filterTypes.includes(card.type)) {
                return false;
            }

            // Cost filter
            if (filterCosts.length > 0) {
                // If filtering by 'X', exclude Leaders
                if (filterCosts.includes('X')) {
                    if (card.cost === 'X' && card.type === 'Leader') {
                        return false;
                    }
                }
                if (!filterCosts.includes(card.cost)) {
                    return false;
                }
            }

            // Search text filter (matches against name, description, affiliation)
            if (searchText) {
                const searchLower = searchText.toLowerCase();
                const matchName = card.name?.toLowerCase().includes(searchLower);
                const matchDesc = card.description?.toLowerCase().includes(searchLower);
                const matchAff = Array.isArray(card.affiliation)
                    ? card.affiliation.some(aff => aff?.toLowerCase().includes(searchLower))
                    : card.affiliation?.toLowerCase().includes(searchLower);
                if (!matchName && !matchDesc && !matchAff) {
                    return false;
                }
            }

            return true;
        });
    }, [allCards, filterTypes, filterCosts, searchText]);

    const handleFilterChange = useCallback(({ types, costs, searchText: search }) => {
        setFilterTypes(types);
        setFilterCosts(costs);
        setSearchText(search);
    }, []);

    const handleSortChange = useCallback(({ sortBy: sort, sortOrder: order }) => {
        setSortBy(sort);
        setSortOrder(order);
    }, []);

    const handleExport = useCallback(async () => {
        return await exportCardsToCompressedString();
    }, []);

    const handleImport = useCallback(async (compressedString, options) => {
        const imported = await importCardsFromCompressedString(compressedString, options);
        window.location.reload(); // Refresh to reload from DB
        return imported;
    }, []);

    const handleCardUpdate = useCallback(async (id, updates) => {
        await updateCard(id, updates);
        dispatch(cardActions.updateCard(id, updates));
        // Update selected card if it's the one being edited
        if (selectedCard?.id === id) {
            setSelectedCard(prev => ({ ...prev, ...updates }));
        }
    }, [dispatch, selectedCard]);

    const handleCardDelete = useCallback(async (id) => {
        await deleteCardFromDb(id);
        dispatch(cardActions.deleteCard(id));
        // Clear selection if deleted card was selected
        if (selectedCard?.id === id) {
            setSelectedCard(null);
        }
    }, [dispatch, selectedCard]);

    return (
        <div className="w-screen h-screen bg-gray-100 p-10 flex flex-col">
            {/* Control Panel */}
            <ControlPanel
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
                onExport={handleExport}
                onImport={handleImport}
            />

            <div className="grid grid-cols-[2fr_1fr_2fr] gap-5 flex-1 min-h-0">
                {/* Left Column */}
                <div className="flex flex-col gap-5 min-h-0">
                    {/* Counter and Diagram Section */}
                    <div className="flex-1 border-[3px] border-orange-400 rounded-3xl bg-white flex items-center justify-center p-5 pb-0">
                        <BarGraph data={filteredCards} />
                    </div>

                    {/* Controller Section */}
                    <div className="flex-1 border-[3px] border-red-300 rounded-3xl bg-white flex items-center justify-center p-5">
                        <CardController />
                    </div>
                </div>

                {/* Current Card List Section */}
                <div className="border-[3px] border-gray-300 rounded-3xl bg-white flex flex-col p-2 min-h-0">
                    <CardList
                        filteredCards={filteredCards}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSelect={setSelectedCard}
                        selectedId={selectedCard?.id}
                    />
                </div>

                {/* Card Section */}
                <div className="border-[3px] border-blue-400 rounded-3xl bg-white flex items-center justify-center p-5">
                    {selectedCard ? (
                        <CardShow
                            {...selectedCard}
                            onUpdate={handleCardUpdate}
                            onDelete={handleCardDelete}
                        />
                    ) : (
                        <p className="font-mono text-lg text-blue-400">Select a card from list</p>
                    )}
                </div>
            </div>
        </div >
    );
};

const CardManager = () => (
    <CardProvider>
        <CardManagerContent />
    </CardProvider>
);

export default CardManager;