import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';

interface Wagon {
    wagonType: string;
    location: number;
    salesNumber: number;
    length: number;
    vehicleNumber?: string;
    playground?: boolean;
    pet?: boolean;
    catering?: boolean;
    video?: boolean;
    luggage?: boolean;
    smoking?: boolean;
    disabled?: boolean;
}

interface JourneySection {
    wagons: Wagon[];
    totalLength: number;
    maximumSpeed: number;
}

interface TrainCompositionViewProps {
    section: JourneySection;
    translations: {
        playground: string;
        pet: string;
        catering: string;
        disabled: string;
        wagons: string;
        maxSpeed: string;
    };
}

// Helper function to get the SVG filename for a wagon type
const getWagonSvg = (wagonType: string): string => {
    // Direct matches
    const directMatches = ['Dm12', 'Gd', 'Gfot', 'Sm1', 'Sm2', 'Sm4', 'Sm5'];
    if (directMatches.includes(wagonType)) {
        return `/trainmodels/${wagonType}.svg`;
    }

    // If contains "Ed"
    if (wagonType.includes('Ed')) {
        return '/trainmodels/Ed.svg';
    }

    // If contains "x" or "Emt"
    if (wagonType.includes('x') || wagonType.includes('Emt')) {
        return '/trainmodels/x.svg';
    }

    // Default fallback to x.svg
    return '/trainmodels/x.svg';
};

export default function TrainCompositionView({ section, translations }: TrainCompositionViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [needsScaling, setNeedsScaling] = useState(false);

    const sortedWagons = section.wagons
        .sort((a, b) => (a.location - b.location));

    // Check if all wagons are Sm or Dm trains (commuter trains that should fit on screen)
    const isCommuterTrain = sortedWagons.every(wagon =>
        ['Sm1', 'Sm2', 'Sm4', 'Sm5', 'Dm12'].includes(wagon.wagonType)
    );

    // Check if content needs scaling
    useEffect(() => {
        if (!isCommuterTrain || !containerRef.current || !contentRef.current) {
            setNeedsScaling(false);
            return;
        }

        const checkFit = () => {
            const containerWidth = containerRef.current?.offsetWidth || 0;
            const contentWidth = contentRef.current?.scrollWidth || 0;
            setNeedsScaling(contentWidth > containerWidth);
        };

        checkFit();
        window.addEventListener('resize', checkFit);
        return () => window.removeEventListener('resize', checkFit);
    }, [isCommuterTrain, sortedWagons]);

    // Apply horizontal scaling for commuter trains only if they don't fit
    const horizontalScale = isCommuterTrain && needsScaling ? 0.5 : 1;

    // Check if wagon type should hide the number
    const shouldHideNumber = (wagonType: string): boolean => {
        const hideTypes = ['Sm1', 'Sm2', 'Sm4', 'Sm5', 'Dm12'];
        return hideTypes.includes(wagonType);
    };

    // Check if wagon is a car transport wagon
    const isCarWagon = (wagonType: string): boolean => {
        return wagonType === 'Gd' || wagonType === 'Gfot';
    };

    // Check if wagon is a sleeper wagon
    const isSleeperWagon = (wagonType: string): boolean => {
        const excludeTypes = ['Sm1', 'Sm2', 'Sm3', 'Sm4', 'Sm5', 'Dm12'];
        return wagonType.includes('m') && !excludeTypes.includes(wagonType);
    };

    // Check if wagon is first class
    const isFirstClass = (wagonType: string): boolean => {
        return wagonType.includes('C');
    };

    // Check if wagon is a bicycle wagon
    const isBicycleWagon = (wagonType: string): boolean => {
        return wagonType === 'Edg';
    };

    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            <div
                ref={contentRef}
                className="is-flex"
                style={{
                    gap: '1px',
                    width: '100%',
                    flexWrap: isCommuterTrain ? 'nowrap' : 'wrap'
                }}
            >
                {sortedWagons.map((wagon, idx) => (
                    <div
                        key={idx}
                        className="is-relative is-flex is-flex-direction-column is-justify-content-flex-end"
                        style={{
                            textAlign: 'center'
                        }}
                        title={[
                            wagon.wagonType,
                            wagon.salesNumber > 0 ? `#${wagon.salesNumber}` : null,
                            wagon.playground ? translations.playground : null,
                            wagon.pet ? translations.pet : null,
                            wagon.catering ? translations.catering : null,
                            wagon.disabled ? translations.disabled : null,
                        ].filter(Boolean).join(' • ')}
                    >
                        {/* Wagon number and amenity icons above the wagon - hide for Sm1, Sm2, Sm4, Sm5 trains */}
                        {!(['Sm1', 'Sm2', 'Sm4', 'Sm5'].includes(wagon.wagonType)) && (
                            <div className="is-flex is-flex-direction-column is-align-items-center mb-1">
                                {/* Wagon number */}
                                {!shouldHideNumber(wagon.wagonType) && (
                                    <div className="is-size-7 has-text-weight-bold">
                                        {wagon.salesNumber > 0 ? wagon.salesNumber : wagon.location}
                                    </div>
                                )}

                                {/* Amenity icons */}
                                <div className="is-flex is-justify-content-center" style={{ gap: '2px', minHeight: '20px' }}>
                                    {isFirstClass(wagon.wagonType) && (
                                        <span className="icon is-small has-text-warning-80" title="First Class">
                                            <i className="fas fa-crown fa-xs"></i>
                                        </span>
                                    )}
                                    {isSleeperWagon(wagon.wagonType) && (
                                        <span className="icon is-small has-text-info" title="Sleeper">
                                            <i className="fas fa-bed fa-xs"></i>
                                        </span>
                                    )}
                                    {isCarWagon(wagon.wagonType) && (
                                        <span className="icon is-small has-text-primary-60" title="Car Transport">
                                            <i className="fas fa-car fa-xs"></i>
                                        </span>
                                    )}
                                    {isBicycleWagon(wagon.wagonType) && (
                                        <span className="icon is-small has-text-success" title="Bicycle Transport">
                                            <i className="fas fa-bicycle fa-xs"></i>
                                        </span>
                                    )}
                                    {wagon.playground && (
                                        <span className="icon is-small has-text-info" title={translations.playground}>
                                            <i className="fas fa-child fa-xs"></i>
                                        </span>
                                    )}
                                    {wagon.pet && (
                                        <span className="icon is-small has-text-warning" title={translations.pet}>
                                            <i className="fas fa-paw fa-xs"></i>
                                        </span>
                                    )}
                                    {wagon.catering && (
                                        <span className="icon is-small has-text-danger" title={translations.catering}>
                                            <i className="fas fa-utensils fa-xs"></i>
                                        </span>
                                    )}
                                    {wagon.disabled && (
                                        <span className="icon is-small has-text-link" title={translations.disabled}>
                                            <i className="fas fa-wheelchair fa-xs"></i>
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SVG Image */}
                        <div
                            className="is-relative is-flex is-align-items-flex-end"
                            style={{
                                height: '40px',
                                overflow: 'visible'
                            }}
                        >
                            <div style={{
                                transform: `scaleX(${horizontalScale})`,
                                transformOrigin: 'left center',
                                display: 'flex',
                                alignItems: 'flex-end',
                                height: '100%'
                            }}>
                                <Image
                                    src={getWagonSvg(wagon.wagonType)}
                                    alt={wagon.wagonType}
                                    width={0}
                                    height={
                                        getWagonSvg(wagon.wagonType) === '/trainmodels/x.svg' ? 25 :
                                            wagon.wagonType === 'Gfot' || wagon.wagonType === 'Gd' ? 35 :
                                                40
                                    }
                                    style={{
                                        width: 'auto',
                                        height: getWagonSvg(wagon.wagonType) === '/trainmodels/x.svg' ? '25px' :
                                            wagon.wagonType === 'Gfot' || wagon.wagonType === 'Gd' ? '35px' :
                                                '40px',
                                        display: 'block',
                                        filter: 'var(--wagon-svg-filter, none)'
                                    }}
                                    priority
                                />
                            </div>
                        </div>

                        {/* Wagon type and number below SVG */}
                        <div className="is-size-7 has-text-grey mt-1">
                            {wagon.wagonType}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
