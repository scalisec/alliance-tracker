import { Select } from '../ui.jsx';

const AGE_ORDER = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U18'];
const LEVEL_ORDER = ['AAA', 'AA-A', 'BB', 'MD'];

export default function DivisionPicker({ ctx, scoredOnly = false }) {
  const divs = ctx.divisions.filter((d) => !scoredOnly || d.scored);
  const current = ctx.divById(ctx.div) ?? divs[0];
  if (!current) return null;
  const ages = AGE_ORDER.filter((a) => divs.some((d) => d.age === a));
  const levels = LEVEL_ORDER.filter((l) => divs.some((d) => d.age === current.age && d.level === l));

  const pick = (age, level) => {
    const match = divs.find((d) => d.age === age && d.level === level) ?? divs.find((d) => d.age === age);
    if (match) ctx.setDiv(match.id);
  };

  return (
    <div className="filters">
      <Select label="Age group" value={current.age} options={ages} onChange={(a) => pick(a, current.level)} />
      <Select label="Level" value={current.level} options={levels} onChange={(l) => pick(current.age, l)} />
    </div>
  );
}
