/**
 * All game-mode templates, in the order the Templates dialog lists them.
 * To add one: create a file next to this one and add it to the list.
 */
import type { Template } from '../../types.ts';
import { targetGallery } from './target-gallery.ts';
import { teamElimination } from './team-elimination.ts';

export const TEMPLATES: Template[] = [targetGallery, teamElimination];
