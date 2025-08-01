'use client';

import { Drawer } from 'vaul';
import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';

interface DateTimeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    onDateTimeChange: (date: Date, isRealtime: boolean) => void;
}

export default function DateTimeDrawer({ isOpen, onClose, selectedDate, onDateTimeChange }: DateTimeDrawerProps) {
    const t = useTranslations('timetables.dateTimeDrawer');
    const locale = useLocale();
    const [tempDate, setTempDate] = useState(selectedDate);

    const formatDateForInput = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatTimeForInput = (date: Date) => {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [year, month, day] = e.target.value.split('-').map(Number);
        const newDate = new Date(tempDate);
        newDate.setFullYear(year, month - 1, day);
        setTempDate(newDate);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [hours, minutes] = e.target.value.split(':').map(Number);
        const newDate = new Date(tempDate);
        newDate.setHours(hours, minutes);
        setTempDate(newDate);
    };

    const handleApply = () => {
        const isRealtimeState = isRealtime(tempDate);
        onDateTimeChange(tempDate, isRealtimeState);
        onClose();
    };

    const handleCancel = () => {
        setTempDate(selectedDate); // Reset to original value
        onClose();
    };

    const handleSetToNow = () => {
        const now = new Date();
        setTempDate(now);
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isRealtime = (date: Date) => {
        const now = new Date();
        const timeDiff = Math.abs(date.getTime() - now.getTime());
        return timeDiff < 60 * 1000;
    };

    const isModified = () => {
        return !isRealtime(tempDate);
    };

    const isTomorrow = (date: Date) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return date.toDateString() === tomorrow.toDateString();
    };

    const getDateLabel = (date: Date) => {
        if (isToday(date)) {
            return t('today');
        } else if (isTomorrow(date)) {
            return t('tomorrow');
        } else {
            return date.toLocaleDateString(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });

        }
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
            <Drawer.Portal>
                <Drawer.Overlay
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }}
                />
                <Drawer.Content
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        height: 'auto',
                        flexDirection: 'column',
                        borderRadius: '10px 10px 0 0',
                        zIndex: 10002,
                        backgroundColor: 'var(--bulma-scheme-main)',
                        color: 'var(--bulma-text)',
                        width: '100%',
                        maxWidth: '600px',
                        margin: '0 auto',
                        textAlign: 'left'
                    }}
                >
                    <div style={{
                        padding: '1rem',
                        backgroundColor: 'var(--bulma-background)',
                        borderTopLeftRadius: '10px',
                        borderTopRightRadius: '10px'
                    }}>
                        {/* Handle bar */}
                        <div
                            style={{
                                margin: '0 auto',
                                width: '3rem',
                                height: '0.375rem',
                                flexShrink: 0,
                                borderRadius: '9999px',
                                backgroundColor: 'var(--bulma-text-weak)',
                                marginBottom: '1rem',
                            }}
                        />

                        <Drawer.Title style={{
                            fontWeight: 500,
                            marginBottom: '1rem',
                            fontSize: '1.25rem',
                            textAlign: 'center'
                        }}>
                            {t('title')}
                        </Drawer.Title>

                        <div style={{ marginBottom: '1.5rem' }}>
                            {/* Current selection display */}
                            <div className="notification" style={{ marginBottom: '1rem', backgroundColor: 'var(--bulma-scheme-main)' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                        {getDateLabel(tempDate)}
                                    </p>
                                    {!isRealtime(tempDate) && <p style={{ fontSize: '1.1rem' }}>
                                        {tempDate.toLocaleTimeString("fi-FI", {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>}

                                    {/* State indicator */}
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <span className={`tag ${isRealtime(tempDate) ? 'is-success' : 'is-warning'}`}>
                                            {isRealtime(tempDate) ? (
                                                <>
                                                    <span className="icon is-small">
                                                        <i className="fas fa-broadcast-tower"></i>
                                                    </span>
                                                    <span>{t("realtime")}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="icon is-small">
                                                        <i className="fas fa-clock"></i>
                                                    </span>
                                                    <span>{t("modified")}</span>
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick selection buttons */}
                            {isModified() && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <div className="buttons is-centered">
                                        <button
                                            className="button"
                                            onClick={handleSetToNow}
                                        >
                                            <span className="icon">
                                                <i className="fas fa-clock-rotate-left"></i>
                                            </span>
                                            <span>{t('reset')}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Date input */}
                            <div className="field">
                                <label className="label">{t('date')}</label>
                                <div className="control">
                                    <input
                                        className="input"
                                        type="date"
                                        value={isRealtime(tempDate) ? formatDateForInput(new Date()) : formatDateForInput(tempDate)}
                                        onChange={handleDateChange}
                                    />
                                </div>
                            </div>

                            {/* Time input */}
                            <div className="field">
                                <label className="label">{t('time')}</label>
                                <div className="control">
                                    <input
                                        className="input"
                                        type="time"
                                        value={isRealtime(tempDate) ? formatTimeForInput(new Date()) : formatTimeForInput(tempDate)}
                                        onChange={handleTimeChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="field is-grouped">
                            <div className="control is-expanded">
                                <button
                                    className="button is-fullwidth"
                                    onClick={handleCancel}
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                            <div className="control is-expanded">
                                <button
                                    className="button is-primary is-fullwidth"
                                    onClick={handleApply}
                                >
                                    <span className="icon">
                                        <i className="fas fa-check"></i>
                                    </span>
                                    <span>{t('apply')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
