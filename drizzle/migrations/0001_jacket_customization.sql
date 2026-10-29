ALTER TABLE public.orders
  ADD COLUMN initials text NOT NULL DEFAULT 'EM',
  ADD COLUMN country text NOT NULL DEFAULT 'SY',
  ADD COLUMN sleeve_number text NOT NULL DEFAULT '09';

ALTER TABLE public.orders
  ADD CONSTRAINT orders_initials_length CHECK (char_length(initials) BETWEEN 1 AND 2),
  ADD CONSTRAINT orders_country_code CHECK (country ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT orders_sleeve_number CHECK (sleeve_number IN ('07', '08', '09'));
