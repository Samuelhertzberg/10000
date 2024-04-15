import Color from "color"
import seedrandom from "seedrandom"

const getPlayerColors = (name: string) => {
    const r = seedrandom(name)
    const rand = Math.floor(r() * 1000000000)
    const hex = '#' + rand.toString(16).substring(0, 6)
    const hexLight = Color(hex).lighten(0.1).hex()
    return {primary: hex, secondary: hexLight}
}

export { getPlayerColors }