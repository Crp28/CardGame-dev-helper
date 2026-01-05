
'use client'

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { createCard, createCardsFromJsonString } from '@/lib/server/cardio';
import { CardProvider, cardActions, useCards } from './CardContext';

const formatAffiliation = (affiliation = []) => affiliation.join(' ');

const BarGraph = ({ data }) => {
    const { cards } = useCards();
    const [selectedCost, setSelectedCost] = useState(null);
    const graphData = data ?? cards;
    const sanitizedGraphData = useMemo(() => {
        if (!graphData || typeof graphData !== 'object') return {};
        return Object.entries(graphData).reduce((acc, [key, value]) => {
            if (key === '' || key == null) return acc;
            const bucket = (value || []).filter(card => card?.type !== 'Leader');
            if (!bucket.length) return acc;
            acc[key] = bucket;
            return acc;
        }, {});
    }, [graphData]);
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

const CardList = ({ onSelect, selectedId }) => {
    const { cards } = useCards();

    const allCards = useMemo(() => Object.values(cards).flat(), [cards]);

    if (!allCards.length) {
        return <p className="font-mono text-sm text-gray-400">No cards yet</p>;
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

const CardShow = (selectedCard) => {
    return (
        <div className="w-full flex flex-col gap-2 text-gray-800">
            <div className="flex items-center gap-3">
                <span className="text-blue-500 font-mono text-sm min-w-6">{selectedCard.type === 'Leader' ? '⭐' : selectedCard.cost}</span>
                <div className="flex flex-col">
                    <span className="font-mono text-lg font-semibold">{selectedCard.name}</span>
                    <span className="font-mono text-xs text-gray-500">{selectedCard.type}</span>
                    {selectedCard.affiliation?.length ? (
                        <span className="font-mono text-xs text-gray-500">{formatAffiliation(selectedCard.affiliation)}</span>
                    ) : null}
                </div>
            </div>
            {selectedCard.description ? (
                <pre className="font-mono text-sm text-gray-700 leading-snug text-wrap">{selectedCard.description}</pre>
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-600">
                {'attack' in selectedCard ? <div>ATK: {selectedCard.attack}</div> : null}
                {'life' in selectedCard ? <div>LIFE: {selectedCard.life}</div> : null}
                {'phyRes' in selectedCard ? <div>PHY RES: {selectedCard.phyRes}</div> : null}
                {'magRes' in selectedCard ? <div>MAG RES: {selectedCard.magRes}</div> : null}
            </div>
        </div>
    )
}

const CardManagerContent = () => {
    const { cards } = useCards();
    const [selectedCard, setSelectedCard] = useState(null);

    return (
        <div className="w-screen h-screen bg-gray-100 p-10 flex flex-col">
            {/* <h2 className="text-center text-gray-400 text-xl font-light mb-8 font-mono">
                Window
            </h2> */}

            {/* Control Panel */}
            <div className='w-[50%] mx-auto text-center text-gray-400 text-xl font-light mb-8 font-mono rounded-3xl bg-white p-3'>Control Panel</div>

            <div className="grid grid-cols-[2fr_1fr_2fr] gap-5 flex-1 min-h-0">
                {/* Left Column */}
                <div className="flex flex-col gap-5 min-h-0">
                    {/* Counter and Diagram Section */}
                    <div className="flex-1 border-[3px] border-orange-400 rounded-3xl bg-white flex items-center justify-center p-5 pb-0">
                        <BarGraph data={cards} />
                    </div>

                    {/* Controller Section */}
                    <div className="flex-1 border-[3px] border-red-300 rounded-3xl bg-white flex items-center justify-center p-5">
                        <CardController />
                    </div>
                </div>

                {/* Current Card List Section */}
                <div className="border-[3px] border-gray-300 rounded-3xl bg-white flex flex-col p-2 min-h-0">
                    <CardList onSelect={setSelectedCard} selectedId={selectedCard?.id} />
                </div>

                {/* Card Section */}
                <div className="border-[3px] border-blue-400 rounded-3xl bg-white flex items-center justify-center p-5">
                    {selectedCard ? (
                        <CardShow {...selectedCard} />
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