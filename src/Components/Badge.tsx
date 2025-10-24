import Icon from '@mdi/react';
import { mdiStar, mdiSleep , mdiChartLine } from '@mdi/js';
import { Box, Tooltip } from '@mui/material';

export type BadgeType = 'highest' | 'lowest' | 'mostRounds';

type BadgeProps = {
    type: BadgeType;
    size?: number;
    color?: string;
    opacity?: number;
};

const badgeConfig = {
    highest: {
        icon: mdiStar,
        label: 'Highest scoring round'
    },
    lowest: {
        icon: mdiSleep ,
        label: 'Lowest scoring round'
    },
    mostRounds: {
        icon: mdiChartLine,
        label: 'Scored in most rounds'
    },
};

export const Badge: React.FC<BadgeProps> = ({ type, size = 0.8, color, opacity = 1 }) => {
    const config = badgeConfig[type];

    return (
        <Tooltip title={config.label} arrow>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', opacity }}>
                <Icon path={config.icon} size={size} color={color} />
            </Box>
        </Tooltip>
    );
};

export const BadgeLegend: React.FC<{ badges: BadgeType[]; color?: string }> = ({ badges, color }) => {
    if (badges.length === 0) return null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1, fontSize: '0.9em' }}>
            {badges.map((badgeType) => {
                const config = badgeConfig[badgeType];
                return (
                    <Box key={badgeType} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Icon path={config.icon} size={0.6} color={color} />
                        <span>{config.label}</span>
                    </Box>
                );
            })}
        </Box>
    );
};
