import { supabase } from "./supabaseClient";

export type Perfil = "ADMIN" | "INSPETOR" | "MECANICO" | "ALMOX";

export async function getMyProfile() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id,nome,email,perfil")
    .eq("id", uid)
    .single();

  if (error) return null;
  return data as { id: string; nome: string; email: string; perfil: Perfil };
}
