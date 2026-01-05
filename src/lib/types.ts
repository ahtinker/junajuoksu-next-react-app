export interface Cause {
    categoryCodeId: number;
    categoryCode?: string;
    detailedCategoryCodeId?: number;
    detailedCategoryCode?: string;
    thirdCategoryCodeId?: number;
    thirdCategoryCode?: string;
}

export interface TimeTableRow {
    actualTime: string | undefined;
    stationShortCode: string;
    stationUICCode: number;
    stationName: string;
    countryCode: string;
    type: 'DEPARTURE' | 'ARRIVAL';
    trainStopping: boolean;
    trainType: string;
    trainNumber: number;
    departureDate: string;
    commuterLineID?: string;
    runningCurrently: boolean;
    cancelled: boolean;
    scheduledTime: string;
    liveEstimateTime?: string | undefined;
    estimateSource?: string;
    differenceInMinutes?: number;
    causes: Cause[];
    relations: unknown[];
    commercialTrack?: string;
    commercialStop: boolean;
}

export interface Train {
    trainNumber: number;
    departureDate: string;
    trainType: string;
    trainCategory: string;
    commuterLineID?: string;
    runningCurrently: boolean;
    cancelled: boolean;
    deleted?: boolean;
    version: number;
    timetableType: string;
    timetableAcceptanceDate: string;
    timeTableRows: TimeTableRow[];
}

export interface StationFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        passengerTraffic: boolean;
        type: 'STATION';
        stationName: string;
        stationShortCode: string;
        stationUICCode: number;
        countryCode: string;
    };
}
