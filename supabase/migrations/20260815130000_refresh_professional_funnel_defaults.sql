alter table public.funnel_settings
  alter column hero_headline set default 'Build a More Structured High-Ticket Reselling Business',
  alter column hero_body set default 'Apply to discuss your reselling experience, goals, and whether the Inner Circle is the right next step.',
  alter column waitlist_heading set default 'Apply to the Inner Circle',
  alter column cta_label set default 'Start your application',
  alter column auto_advance_delay_ms set default 0;

update public.funnel_settings
set
  hero_headline = 'Build a More Structured High-Ticket Reselling Business',
  hero_body = case
    when btrim(hero_body) = '' then 'Apply to discuss your reselling experience, goals, and whether the Inner Circle is the right next step.'
    else hero_body
  end,
  waitlist_heading = case
    when waitlist_heading in ('Apply Now', 'Join the Waitlist') then 'Apply to the Inner Circle'
    else waitlist_heading
  end,
  cta_label = case
    when cta_label = 'Get Started Now' then 'Start your application'
    else cta_label
  end,
  auto_advance_delay_ms = case
    when auto_advance_delay_ms = 240 then 0
    else auto_advance_delay_ms
  end
where id = 'default'
  and hero_headline in (
    'See How Regular People Are Building $5K-$30K/Month High-Ticket Reselling Businesses',
    'The Inner Circle Is Currently Closed'
  );
