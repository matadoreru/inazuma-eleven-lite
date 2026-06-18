import { useCareerStore } from './store/careerStore'
import { useInboxSound } from './hooks/useInboxSound'
import MainMenuScreen from './screens/MainMenuScreen'
import NewCareerScreen from './screens/NewCareerScreen'
import CareerHomeScreen from './screens/CareerHomeScreen'
import ClubScreen from './screens/ClubScreen'
import SquadScreen from './screens/SquadScreen'
import PlayerDetailScreen from './screens/PlayerDetailScreen'
import FormationScreen from './screens/FormationScreen'
import TrainingScreen from './screens/TrainingScreen'
import CalendarScreen from './screens/CalendarScreen'
import MatchScreen from './screens/MatchScreen'
import LiveMatchScreen from './screens/LiveMatchScreen'
import StandingsScreen from './screens/StandingsScreen'
import TransfersScreen from './screens/TransfersScreen'
import SaveLoadScreen from './screens/SaveLoadScreen'
import SeasonReviewScreen from './screens/SeasonReviewScreen'
import NotificationsDrawer from './components/NotificationsDrawer'
import SettingsDrawer from './components/SettingsDrawer'

export type Screen =
  | 'main_menu'
  | 'new_career'
  | 'career_home'
  | 'club'
  | 'squad'
  | 'player_detail'
  | 'formation'
  | 'training'
  | 'calendar'
  | 'match'
  | 'match_live'
  | 'standings'
  | 'transfers'
  | 'scout'
  | 'save_load'
  | 'season_review'

export default function App() {
  const screen = useCareerStore((s) => s.screen)
  useInboxSound()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {screen === 'main_menu' && <MainMenuScreen />}
      {screen === 'new_career' && <NewCareerScreen />}
      {screen === 'career_home' && <CareerHomeScreen />}
      {screen === 'club' && <ClubScreen />}
      {screen === 'squad' && <SquadScreen />}
      {screen === 'player_detail' && <PlayerDetailScreen />}
      {screen === 'formation' && <FormationScreen />}
      {screen === 'training' && <TrainingScreen />}
      {screen === 'calendar' && <CalendarScreen />}
      {screen === 'match' && <MatchScreen />}
      {screen === 'match_live' && <LiveMatchScreen />}
      {screen === 'standings' && <StandingsScreen />}
      {screen === 'transfers' && <TransfersScreen />}
      {screen === 'scout' && <ScoutScreen />}
      {screen === 'save_load' && <SaveLoadScreen />}
      {screen === 'season_review' && <SeasonReviewScreen />}

      {/* Global overlay drawers — rendered above all screens */}
      <NotificationsDrawer />
      <SettingsDrawer />
    </div>
  )
}
