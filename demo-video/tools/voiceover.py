import asyncio,json,math,re,subprocess
from pathlib import Path
import edge_tts
ROOT=Path(__file__).resolve().parents[1]
async def main():
    scenes=[];srt=[];offset=0
    for scene in json.loads((ROOT/'script.json').read_text()):
        path=ROOT/'public'/'voice'/f"{scene['id']}.mp3";path.parent.mkdir(parents=True,exist_ok=True)
        words=[]
        speech=edge_tts.Communicate(scene['text'],'en-GB-RyanNeural',rate='+4%',boundary='WordBoundary')
        with path.open('wb') as f:
            async for chunk in speech.stream():
                if chunk['type']=='audio':f.write(chunk['data'])
                elif chunk['type']=='WordBoundary':words.append({'text':chunk['text'],'start':chunk['offset']/10000000,'end':(chunk['offset']+chunk['duration'])/10000000})
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)],text=True))
        captions=[]
        for i in range(0,len(words),8):
            group=words[i:i+8];captions.append({'text':' '.join(w['text'] for w in group),'start':group[0]['start']+.35,'end':group[-1]['end']+.35})
        frames=math.ceil((duration+1.1)*30)
        scenes.append({**scene,'frames':frames,'audioDuration':duration,'captions':captions})
        def stamp(t):
            m=round(t*1000);return f'{m//3600000:02}:{m//60000%60:02}:{m//1000%60:02},{m%1000:03}'
        for c in captions:srt.append(f"{len(srt)+1}\n{stamp(offset+c['start'])} --> {stamp(offset+c['end'])}\n{c['text']}\n")
        offset+=frames/30;print(scene['id'],round(duration,2),flush=True)
    (ROOT/'src'/'timeline.json').write_text(json.dumps(scenes,indent=2))
    (ROOT/'panelpay-demo.srt').write_text('\n'.join(srt))
    (ROOT/'transcript.txt').write_text('\n\n'.join(s['text'] for s in scenes))
    print('Duration',round(offset,2),'seconds')
asyncio.run(main())
