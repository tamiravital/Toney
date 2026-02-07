export type TensionType = 'avoid' | 'worry' | 'chase' | 'perform' | 'numb' | 'give' | 'grip';

export interface TensionDetails {
  verb: string;
  description: string;
  root_feelings: string;
  common_behaviors: string[];
  underlying_need: string;
  reframe: string;
  first_step: string;
  conversation_starters: string[];
  color: string;
}

export interface IdentifiedTension {
  primary: TensionType;
  primaryScore: number;
  primaryDetails: TensionDetails;
  secondary?: TensionType;
  secondaryScore?: number;
  secondaryDetails?: TensionDetails;
}

export interface TensionColors {
  bg: string;
  text: string;
  accent: string;
  light: string;
  border: string;
}
