import { Composition } from "remotion";
import { FPS, HEIGHT, TOTAL, WIDTH } from "./brand";
import { NotesAppIdeas, type NotesAppIdeasProps } from "./NotesAppIdeas";

export const Root = () => (
  <Composition
    id="NotesAppIdeas"
    component={NotesAppIdeas}
    durationInFrames={TOTAL}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={{ music: true, voiceover: true }}
  />
);
