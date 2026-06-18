import { useCareerStore } from '../store/careerStore'

export function useNameStyle(): 'western' | 'japanese' {
  return useCareerStore((s) => s.career?.nameStyle ?? 'western')
}
