export const BANKED_POINTS_BIN_SIZE = 50

export type BankedPointsScoreEvent = {
  id: string
  createdAt: Date
  points: number | null
  slot: number | null
  totalScore: number | null
  maxPoints: number | null
}

export type BankedPointsHeatmapCell = {
  current_score: number
  accepted_points: number
  round_count: number
}

const binValue = (value: number) =>
  Math.floor(value / BANKED_POINTS_BIN_SIZE) * BANKED_POINTS_BIN_SIZE

const validTarget = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null

export const buildBankedPointsHeatmap = (
  eventsBySession: Map<string, BankedPointsScoreEvent[]>,
  sessionTargets: Map<string, number>,
) => {
  const counts = new Map<string, BankedPointsHeatmapCell>()

  eventsBySession.forEach((scoreEvents, sessionId) => {
    const playerTotals = new Map<number, number>()
    const finishedPlayers = new Set<number>()
    const sessionTarget = validTarget(sessionTargets.get(sessionId)) ?? 10000
    const chronologicalEvents = [...scoreEvents]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))

    chronologicalEvents.forEach((event) => {
      if (event.slot === null || event.points === null) return

      const reconstructedCurrentScore = playerTotals.get(event.slot) ?? 0
      const recordedCurrentScore = event.totalScore === null
        ? null
        : event.totalScore - event.points
      const currentScore = recordedCurrentScore !== null && Number.isFinite(recordedCurrentScore)
        ? recordedCurrentScore
        : reconstructedCurrentScore
      const scoreAfterRound = event.totalScore ?? currentScore + event.points

      if (Number.isFinite(scoreAfterRound)) {
        playerTotals.set(event.slot, scoreAfterRound)
      }

      const target = validTarget(event.maxPoints) ?? sessionTarget
      const playerAlreadyFinished = finishedPlayers.has(event.slot)
      if (scoreAfterRound >= target) finishedPlayers.add(event.slot)
      if (
        playerAlreadyFinished ||
        event.points <= 0 ||
        !Number.isFinite(currentScore) ||
        currentScore < 0 ||
        currentScore >= target
      ) {
        return
      }

      const currentScoreBin = binValue(currentScore)
      const acceptedPointsBin = binValue(event.points)
      const key = `${currentScoreBin}:${acceptedPointsBin}`
      const cell = counts.get(key) ?? {
        current_score: currentScoreBin,
        accepted_points: acceptedPointsBin,
        round_count: 0,
      }
      cell.round_count += 1
      counts.set(key, cell)
    })
  })

  return {
    bin_size: BANKED_POINTS_BIN_SIZE,
    cells: [...counts.values()].sort(
      (a, b) => a.current_score - b.current_score || a.accepted_points - b.accepted_points,
    ),
  }
}
