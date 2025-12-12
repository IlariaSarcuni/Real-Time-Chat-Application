import dayjs from 'dayjs';

/* bimodal palette */
export const getColorFromUsername = (username, theme) => {
    if (!username) return theme === 'dark' ? '#adb5bd' : '#0d6efd';

    const lightModeColors = [
        '#d63384', '#fd7e14', '#198754', '#6610f2', 
        '#dc3545', '#0d6efd', '#6f42c1', '#343a40',
    ];
    const darkModeColors = [
        '#f8f9fa', '#e9ecef', '#dee2e6', '#adb5bd',
        '#0dcaf0', '#20c997', '#ffc107', '#a343ff',
    ];
    const colors = theme === 'dark' ? darkModeColors : lightModeColors;

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
};

export const formatDateLabel = (d) => {
    const date = dayjs(d), today = dayjs(), yest = dayjs().subtract(1, 'day');
    if (date.isSame(today, 'day')) return "Oggi";
    if (date.isSame(yest, 'day')) return "Ieri";
    return date.format('DD/MM/YYYY');
};