alter table public.ai_generation_jobs alter column model set default 'gpt-image-1';

update public.feature_settings
set value = jsonb_set(value, '{model}', '"gpt-image-1"'::jsonb, true), updated_at = now()
where key = 'ai_generation';
