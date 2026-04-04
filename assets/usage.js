function getJSTDateString() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function getCurrentUserOrThrow() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    throw new Error('未ログインです');
  }
  return data.session.user;
}

async function isProUser() {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('is_pro')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return !!(data && data.is_pro === true);
}

async function getTodayDownloadCount() {
  const user = await getCurrentUserOrThrow();
  const today = getJSTDateString();

  const { data, error } = await supabaseClient
    .from('daily_downloads')
    .select('*')
    .eq('user_id', user.id)
    .eq('date_jst', today)
    .maybeSingle();

  if (error) throw error;
  return data ? (data.download_count || 0) : 0;
}

async function canDownloadToday() {
  if (await isProUser()) return true;
  const count = await getTodayDownloadCount();
  return count < 3;
}

async function incrementTodayDownloadCount() {
  if (await isProUser()) return -1;

  const user = await getCurrentUserOrThrow();
  const today = getJSTDateString();

  const { data, error } = await supabaseClient
    .from('daily_downloads')
    .select('*')
    .eq('user_id', user.id)
    .eq('date_jst', today)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { error: insertError } = await supabaseClient
      .from('daily_downloads')
      .insert({
        user_id: user.id,
        date_jst: today,
        download_count: 1
      });

    if (insertError) throw insertError;
    return 1;
  }

  const newCount = (data.download_count || 0) + 1;

  const { error: updateError } = await supabaseClient
    .from('daily_downloads')
    .update({ download_count: newCount })
    .eq('id', data.id);

  if (updateError) throw updateError;
  return newCount;
}