CREATE OR REPLACE FUNCTION public.increment_published_seo_article_view(p_article_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.seo_articles
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_article_id AND published = true;
$$;

REVOKE ALL ON FUNCTION public.increment_published_seo_article_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_published_seo_article_view(uuid) TO service_role;
