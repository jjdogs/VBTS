/**
 * All game-mode templates, in the order the Templates dialog lists them.
 * To add one: create a file next to this one and add it to the list.
 */
import type { Template } from '../../types.ts';
import { targetGallery } from './target-gallery.ts';
import { teamElimination } from './team-elimination.ts';
import { platformParkour } from './platform-parkour.ts';
import { shopMenu } from './shop-menu.ts';

export const TEMPLATES: Template[] = [targetGallery, teamElimination, platformParkour, shopMenu];
