export interface EndScreenProps {
  readonly playerWon: boolean;
  readonly onAgain: () => void;
  readonly onMenu: () => void;
}
