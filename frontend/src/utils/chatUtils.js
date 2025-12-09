import dayjs from 'dayjs';

export const getColorFromUsername = (username) => {
    if (!username) return '#0d6efd';
    const colors = [
        '#d63384', '#fd7e14', '#198754', '#20c997', '#0dcaf0', 
        '#6610f2', '#dc3545', '#0d6efd', '#fd7e14', '#6f42c1', '#adb5bd'
    ];
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