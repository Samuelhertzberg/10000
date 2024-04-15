import seedrandom from "seedrandom"

const getPlayerColors = (name: string) => {
    const r = seedrandom(name)
    const rand = Math.floor(r() * 1000000000)
    return '#' + rand.toString(16).substring(0, 6)
}

export { getPlayerColors }