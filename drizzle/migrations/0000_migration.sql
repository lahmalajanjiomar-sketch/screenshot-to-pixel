CREATE SEQUENCE public.order_number_seq START 1001;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number integer NOT NULL DEFAULT nextval('public.order_number_seq') UNIQUE,
  num text NOT NULL,
  size text NOT NULL,
  name text NOT NULL,
  patch_num integer NOT NULL,
  grade text NOT NULL,
  note text,
  back_style text NOT NULL DEFAULT 'en',
  quote text,
  patches jsonb NOT NULL DEFAULT '[]'::jsonb,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders TO service_role;
GRANT USAGE ON SEQUENCE public.order_number_seq TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;