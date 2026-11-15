// Short, sourced stories for click-to-discover actions. Keep the app's English UI.
const nasa = 'https://science.nasa.gov/';
export const DISCOVERIES = {
  opportunity: [
    { title: 'Clues to ancient water', text: 'Opportunity examined tiny hematite spheres nicknamed “blueberries”. These minerals provided evidence that liquid water once affected these Martian rocks.', action: 'drive', note: 'Illustrative drive during its working years; this is evidence of ancient water.', source: nasa + 'mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/' },
    { title: 'The last signal', text: 'Opportunity last contacted Earth on June 10, 2018, as a planet-wide dust storm blocked sunlight from its solar panels.', action: 'signal', note: 'The fading rings symbolize its final radio contact.', source: nasa + 'mission/mars-exploration-rovers-spirit-and-opportunity/' },
  ],
  sojourner: [
    { title: 'A small rover, a big first', text: 'In 1997, Sojourner became the first rover to operate on Mars. Its instruments examined rocks and soil, helping demonstrate that mobile exploration could work there.', action: 'drive', note: 'Illustrative historical drive; the route is not a recorded traverse.', source: nasa + 'mission/mars-pathfinder/' },
    { title: 'When Pathfinder fell silent', text: 'Pathfinder sent its final data on September 27, 1997. The lander and its little rover, Sojourner, remain at Ares Vallis.', action: 'signal', note: 'The fading rings symbolize communication through the lander.', source: nasa + 'mission/mars-pathfinder/' },
  ],
  apollo15: [
    { title: 'The first wheels on the Moon', text: 'Apollo 15 brought the first lunar rover in 1971. Astronauts David Scott and James Irwin drove it to explore farther from Falcon and collect samples.', action: 'drive', note: 'Illustrative astronaut-driven journey; the lunar rover was not autonomous.', source: nasa + 'solar-system/moon/history-of-lunar-exploration/' },
    { title: 'A piece of the ancient Moon', text: 'The Apollo 15 astronauts collected the Genesis Rock. Its mineral composition helped scientists investigate the Moon’s ancient crust.', action: 'drive', note: 'Illustrative sample-collection journey, not the actual route to the rock.', source: nasa + 'solar-system/moon/history-of-lunar-exploration/' },
  ],
  insight: [
    { title: 'Listening inside Mars', text: 'InSight measured marsquakes. Waves traveling through the planet helped scientists investigate its crust, mantle and core.', action: 'seismic', note: 'The rings illustrate seismic waves. InSight was a stationary lander.', source: nasa + 'mission/insight/science/' },
    { title: 'Dust ended its watch', text: 'Dust reduced the energy reaching InSight’s solar panels. NASA announced the end of the mission in December 2022, after more than four years on Mars.', action: 'signal', note: 'The fading rings symbolize the loss of communication.', source: 'https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/' },
  ],
  near: [
    { title: 'An unexpected survivor', text: 'NEAR Shoemaker was designed as an orbiter, yet survived its landing on asteroid Eros on February 12, 2001. It returned data for about two more weeks.', action: 'signal', note: 'The rings illustrate data sent from the surface after landing.', source: nasa + 'mission/near-shoemaker/' },
    { title: 'A silent visitor on Eros', text: 'The last contact with NEAR came on February 28, 2001. An attempt to reach the probe again in December 2002 was unsuccessful.', action: 'signal', note: 'Illustrative radio signals fade; the spacecraft stays on the surface.', source: nasa + 'mission/near-shoemaker/' },
  ],
  ingenuity: [
    { title: 'Flight on another planet', text: 'On April 19, 2021, Ingenuity made the first powered, controlled flight on another planet. It demonstrated flight in Mars’s thin atmosphere.', action: 'flight', note: 'A brief historical flight illustration, before its flying career ended.', source: nasa + 'mission/mars-2020-perseverance/ingenuity-mars-helicopter/' },
    { title: 'Five planned. Seventy-two flown.', text: 'Ingenuity was designed for up to five test flights. It completed 72 flights, with its final flight on January 18, 2024.', action: 'flight', note: 'A tribute to its working years, not a reconstruction of the final flight.', source: nasa + 'mission/mars-2020-perseverance/ingenuity-mars-helicopter/' },
  ],
  eagle: [
    { title: 'The first human landing', text: 'On July 20, 1969, Eagle brought Neil Armstrong and Buzz Aldrin to the Moon while Michael Collins remained in lunar orbit.', action: 'signal', note: 'The rings illustrate communications during the Apollo 11 mission.', source: 'https://www.nasa.gov/mission/apollo-11/' },
  ],
  voyager: [
    { title: 'Beyond the solar wind', text: 'Voyager 1 crossed the heliopause in August 2012, entering interstellar space. Its measurements opened a new view of the environment beyond the Sun’s bubble of solar wind.', action: 'signal', note: 'The expanding rings illustrate radio communication, not visible light.', source: nasa + 'mission/voyager/voyager-1/' },
    { title: 'A distant portrait of home', text: 'In 1990, Voyager 1 photographed Earth as part of a portrait of the Solar System. That tiny image of our planet became known as the Pale Blue Dot.', action: 'signal', note: 'An illustration of the spacecraft sending information home.', source: nasa + 'mission/voyager/voyager-1/' },
  ],
};
