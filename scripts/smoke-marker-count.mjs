import { execFileSync } from 'node:child_process';

const html=execFileSync('curl',['-fsS','https://afghaneats.net/'],{encoding:'utf8',maxBuffer:5*1024*1024});
for(const marker of ['The taste of Herat','What are you craving','From your favourite kitchen','FROM HERAT, WITH LOVE','Afghan','Kebab · Pizza']){
  const count=html.split(marker).length-1;
  console.log(`${marker}\t${count}`);
}
