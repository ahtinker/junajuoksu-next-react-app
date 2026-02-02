'use client';

import styles from './StationTimetables.module.css';

interface StationSkeletonProps {
    showFullLayout?: boolean;
}

export default function StationSkeleton({ showFullLayout = true }: StationSkeletonProps) {

    if (showFullLayout) {
        return (
            <div className="container mt-4">
                <div className="columns is-centered is-tablet">
                    {/* Left Panel Skeleton */}
                    <div className={`column is-4-desktop is-6-tablet ${styles['mobile-full-height']}`}>
                        <div>

                            <div className="box  is-skeleton" style={{ height: "184px", opacity: "0.2" }}>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel (Timetables) Skeleton */}
                    <div className="column is-responsive">
                        <div className="box  is-skeleton" style={{ height: "300px", opacity: "0.2" }}>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Simplified skeleton for when used in other contexts (like StationTimetables loading)
    return (
        <div className="container">
            <div className="columns is-centered">
                <div className="column is-8">
                    <div className="box has-text-centered is-skeleton">
                        <div className="skeleton-lines">
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
