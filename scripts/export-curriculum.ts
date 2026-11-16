// Exports the entire curriculum to a single readable Markdown file (CURRICULUM.md).
// Run: node scripts/export-curriculum.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { phases, capstones, totals } from '../curriculum/index.ts';
import { challenges } from '../challenges/registry.ts';
import { decisions } from '../curriculum/decisions.ts';
import { designs } from '../curriculum/designs.ts';
import { labs } from '../labs/registry.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const t = totals();
const out: string[] = [];

out.push('# Backend Dev Academy — Full Curriculum\n');
out.push('_Senior frontend → senior backend. ' +
  `${t.phases} phases · ${t.lessons} lessons · ${t.quizzes} quizzes · ${t.challenges} coding challenges · ` +
  `${Object.keys(labs).length} build labs · ${decisions.length} decision scenarios · ${designs.length} system designs._\n`);
out.push('> This is a static export of the content delivered interactively by the `academy` CLI.\n');
out.push('\n---\n');

for (const p of phases) {
  out.push(`\n## ${p.title}\n`);
  out.push(`**Duration:** ${p.weeks} weeks  \n**Goal:** ${p.goal}\n`);
  for (const m of p.modules) {
    out.push(`\n### ${m.title}\n`);
    for (const l of m.lessons) {
      out.push(`\n#### ${l.title}  \n_~${l.minutes} min · id \`${l.id}\`${l.challenge ? ` · challenge \`${l.challenge}\`` : ''}_\n`);
      out.push('\n' + l.body + '\n');
      if (l.quiz?.length) {
        out.push(`\n**Self-check (${l.quiz.length}):**\n`);
        l.quiz.forEach((q, i) => {
          out.push(`${i + 1}. ${q.q}`);
          q.choices.forEach((ch, idx) => out.push(`   - ${idx === q.answer ? '**' + ch + '** ✅' : ch}`));
        });
        out.push('');
      }
    }
  }
  out.push('\n---\n');
}

out.push('\n## Coding Challenges\n');
for (const [id, ch] of Object.entries(challenges)) {
  out.push(`\n### \`${id}\` — ${ch.title}\n`);
  out.push('```\n' + ch.prompt + '\n```\n');
}

out.push('\n## Guided Build Labs\n');
for (const [id, lab] of Object.entries(labs)) {
  out.push(`\n### \`${id}\` — ${lab.title}\n`);
  out.push('Milestones: ' + lab.milestones.map((m) => `**${m.id}** ${m.name}`).join(' → ') + '\n');
  out.push(`You implement \`labs/${lab.dir}/${lab.file}\`; tests gate each milestone.\n`);
}

out.push('\n## Architecture Decision Scenarios\n');
out.push('_Real problems. Make the call, then compare with the senior recommendation._\n');
for (const d of decisions) {
  out.push(`\n### \`${d.id}\` — ${d.title}\n`);
  out.push('**Problem:** ' + d.problem + '\n');
  out.push('\n**Constraints:** ' + d.constraints.map((x) => `_${x}_`).join(' · ') + '\n');
  out.push('\n**' + d.question + '**\n');
  d.options.forEach((o, i) => {
    const tag = { good: '★ strong', ok: '~ defensible', bad: '✗ weak' }[o.verdict];
    out.push(`${i + 1}. **${o.label}** — _${tag}._ ${o.why}`);
  });
  out.push('\n> **Senior call:** ' + d.recommendation);
  out.push('>\n> **Principle:** ' + d.principle + '\n');
}

out.push('\n## System Design Practice\n');
out.push('_Whiteboard each prompt for 45 minutes out loud before reading the model answer._\n');
for (const d of designs) {
  out.push(`\n### \`${d.id}\` — ${d.title}\n`);
  out.push('**Prompt:** ' + d.prompt + '\n');
  out.push('\n**Clarify first:** ' + d.clarify.map((q) => `_${q}_`).join(' · ') + '\n');
  out.push('\n<details><summary>Model answer</summary>\n');
  out.push(d.answer);
  out.push('\n</details>\n');
}

out.push('\n## Capstone Projects\n');
for (const cap of capstones) {
  out.push(`\n### ${cap.title}\n\n${cap.blurb}\n`);
}

writeFileSync(join(__dirname, '..', 'CURRICULUM.md'), out.join('\n'));
console.log('Wrote CURRICULUM.md');
