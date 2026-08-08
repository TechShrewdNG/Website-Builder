/**
 * Project access helpers. Every read and write goes through an ownership
 * check here rather than trusting an id from the request, so a guessed
 * project id gets a 404 instead of someone else's site.
 */

import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from './db';
import { createRoot } from './builder/tree';
import { createNode } from './builder/widgets';
import type { BuilderNode } from './builder/types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    include: { pages: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!project) throw new HttpError(404, 'Project not found');
  return project;
}

export async function requirePage(pageId: string, userId: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, project: { ownerId: userId } },
    include: { project: true },
  });
  if (!page) throw new HttpError(404, 'Page not found');
  return page;
}

/** URL-safe, collision-free project slug. */
export async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'site';

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** A blank page is an empty root; a starter page has something to look at. */
export function starterTree(): BuilderNode {
  const heading = createNode('heading', {});
  heading.props = { text: 'Build something', level: 'h1' };
  heading.styles.desktop = { 'font-size': '48px', 'font-weight': '800', 'line-height': '1.1', margin: '0 0 16px' };

  const text = createNode('text', {});
  text.props = { html: '<p>Drag widgets from the left panel onto the canvas, then style them on the right.</p>' };

  const button = createNode('button');

  const section = createNode('section');
  section.styles.desktop = { ...section.styles.desktop, 'text-align': 'center' };
  section.children = [heading, text, button];

  return createRoot([section]);
}

export function emptyTree(): BuilderNode {
  return createRoot([createNode('section')]);
}

/** "/about/" and "/about" address the same page; "/" stays "/". */
export function normalisePath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Prisma's Json input type rejects interfaces without an index signature, and
 * BuilderNode is deliberately a closed shape. The tree is plain JSON data, so
 * this cast is the narrow place where that mismatch is acknowledged.
 */
export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
