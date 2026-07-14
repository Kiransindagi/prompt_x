import { CreativeMode } from "./creative";
import { DeveloperMode } from "./developer";
import { MarketingMode } from "./marketing";

export const MODE_REGISTRY: Record<string, typeof CreativeMode> = {
    creative: CreativeMode,
    developer: DeveloperMode,
    marketing: MarketingMode,
};

export function getMode(name: string) {
    return MODE_REGISTRY[name.toLowerCase()] || CreativeMode; // Fallback to creative
}
