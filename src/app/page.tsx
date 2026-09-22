import { supabase } from "@/lib/supabase";
import RecipeBookClient from "@/components/RecipeBookClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  return <RecipeBookClient initialRecipes={recipes || []} />;
}