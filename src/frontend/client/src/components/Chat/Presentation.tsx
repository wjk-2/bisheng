import { useRecoilValue } from 'recoil';
import { useEffect } from 'react';
import { FileSources, LocalStorageKeys } from '~/data-provider/data-provider/src';
import type { ExtendedFile } from '~/common';
import { useDeleteFilesMutation } from '~/data-provider';
import DragDropWrapper from '~/components/Chat/Input/Files/DragDropWrapper';
import Artifacts from '~/components/Artifacts/Artifacts';
import { useSetFilesToDelete } from '~/hooks';
import { EditorProvider } from '~/Providers';
import store from '~/store';

export default function Presentation({ isLingsi, children }: { isLingsi: boolean, children: React.ReactNode }) {
  const artifacts = useRecoilValue(store.artifactsState);
  const artifactsVisible = useRecoilValue(store.artifactsVisible);

  const setFilesToDelete = useSetFilesToDelete();

  const { mutateAsync } = useDeleteFilesMutation({
    onSuccess: () => {
      setFilesToDelete({});
    },
    onError: (error) => {
    },
  });

  useEffect(() => {
    const filesToDelete = localStorage.getItem(LocalStorageKeys.FILES_TO_DELETE);
    const map = JSON.parse(filesToDelete ?? '{}') as Record<string, ExtendedFile>;
    const files = Object.values(map)
      .filter(
        (file) =>
          file.filepath != null && file.source && !(file.embedded ?? false) && file.temp_file_id,
      )
      .map((file) => ({
        file_id: file.file_id,
        filepath: file.filepath as string,
        source: file.source as FileSources,
        embedded: !!(file.embedded ?? false),
      }));

    if (files.length === 0) {
      return;
    }
    mutateAsync({ files });
  }, [mutateAsync]);

  // 右侧面板已移除，功能迁移到左侧导航栏
  // 仅保留 Artifacts 代码预览功能
  return (
    <DragDropWrapper isLingsi={isLingsi} className="relative flex w-full grow overflow-hidden bg-presentation">
      {artifactsVisible === true && Object.keys(artifacts ?? {}).length > 0 ? (
        <EditorProvider>
          <Artifacts />
        </EditorProvider>
      ) : null}
      <main className="flex h-full w-full flex-1 flex-col overflow-y-auto" role="main">
        {children}
      </main>
    </DragDropWrapper>
  );
}
