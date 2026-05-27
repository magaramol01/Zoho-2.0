export const minutesToDisplay = (minutes) => {
    if (!minutes) {
        return "0h";
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (!hours) {
        return `${remainingMinutes}m`;
    }
    if (!remainingMinutes) {
        return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
};
export const isoToday = () => new Date().toISOString().slice(0, 10);
export const compactNumber = (value) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
export const unique = (values) => Array.from(new Set(values));
