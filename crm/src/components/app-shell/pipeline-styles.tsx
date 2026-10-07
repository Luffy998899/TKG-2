import 'server-only';
import { pipelineCss } from '@/lib/pipelines/css';
import { BASE_PATH } from '@/lib/base-path';

/**
 * Links the pipeline-colour stylesheet (see /pipeline-styles.css). The version
 * changes whenever an admin edits a colour, so browsers fetch the new one.
 */
export async function PipelineStyles() {
  const { version } = await pipelineCss();
  return <link rel="stylesheet" href={`${BASE_PATH}/pipeline-styles.css?v=${version}`} precedence="default" />;
}
