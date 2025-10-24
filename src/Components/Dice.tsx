import Icon from '@mdi/react';
import { mdiDice1Outline, mdiDice2Outline, mdiDice3Outline, mdiDice4Outline, mdiDice5Outline, mdiDice6Outline } from '@mdi/js';

type DiceProps = {
    value: 1 | 2 | 3 | 4 | 5 | 6;
    size?: number;
};

const diceIcons = {
    1: mdiDice1Outline,
    2: mdiDice2Outline,
    3: mdiDice3Outline,
    4: mdiDice4Outline,
    5: mdiDice5Outline,
    6: mdiDice6Outline,
};

export const Dice: React.FC<DiceProps> = ({ value, size = 0.8 }) => {
    return <Icon path={diceIcons[value]} size={size} />;
};

type DiceRowProps = {
    values: (1 | 2 | 3 | 4 | 5 | 6)[];
    size?: number;
};

export const DiceRow: React.FC<DiceRowProps> = ({ values, size = 0.8 }) => {
    return (
        <>
            {values.map((value, index) => (
                <Dice key={index} value={value} size={size} />
            ))}
        </>
    );
};
