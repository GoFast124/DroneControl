import { useMemo } from 'react'
import { planSurvey } from '../../../shared/survey'
import type { PlanResult } from '../../../shared/survey'
import { useMission, useSurvey } from '../store'

// The survey grid for the current polygon and settings, or null while no area is drawn. Recomputed only when they change.
export function useSurveyPlan(): PlanResult | null {
  const { polygon, settings } = useSurvey()
  const home = useMission().home
  const homeLat = home?.lat
  const homeLon = home?.lon
  return useMemo(() => {
    if (polygon.length === 0) return null
    // Start the pass at the corner nearest home when there is one, so the vehicle doesn't cross the whole area first.
    const near: [number, number] | null = homeLat !== undefined && homeLon !== undefined && (homeLat !== 0 || homeLon !== 0) ? [homeLat, homeLon] : null
    return planSurvey(polygon, settings, near)
  }, [polygon, settings, homeLat, homeLon])
}
