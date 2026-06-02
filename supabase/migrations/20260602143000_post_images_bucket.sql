insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "Post images are publicly readable"
on storage.objects for select
using (bucket_id = 'post-images');

create policy "Users can upload their own post images"
on storage.objects for insert
with check (
  bucket_id = 'post-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own post images"
on storage.objects for update
using (
  bucket_id = 'post-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own post images"
on storage.objects for delete
using (
  bucket_id = 'post-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
