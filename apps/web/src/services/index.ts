/**
 * Barrel module for the service layer.
 *
 * Server functions and route loaders should import services from here so the
 * caller never reaches into per-entity files directly. That makes future
 * refactors (e.g. splitting `match-service.ts` further) invisible to callers.
 */

export {
  DomainError,
  EntityNotFoundError,
  GameMatchLeagueMismatchError,
  PlayerHasHistoryError,
} from './errors';
export { GameResultService } from './game-result-service';
export { GameService } from './game-service';
export { GroupService } from './group-service';
export { LeagueService } from './league-service';
export { MatchService } from './match-service';
export { OwnerService } from './owner-service';
export { PlayerService } from './player-service';
export { RulesetService, TobiConfigurationError } from './ruleset-service';
