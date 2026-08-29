# Content Inventory

This inventory preserves the recovered Genially guide content in `Slides.Order` order.

## Investigation Summary

- `genially.html` is an offline Genially shell with a large `window.dataBase64` payload and links to Genially runtime assets in `static/js` and `css`.
- The main recoverable content is in the decoded JSON top-level arrays: `Slides`, `Texts`, `Images`, `Svgs`, and `interactivityActions`.
- Detected 129 slide records: 32 main/menu/content screens and 97 popup/modal-style slides.
- Page order is recoverable from `Slides[*].Order`.
- Navigation is recoverable from `interactivityActions`, especially `goToSlide`, `slidePopup`, `closeSlidePopup`, `zoom`, `showElements`, `openLink`, and `playAudio`.
- Text is recoverable programmatically from `Texts[*].TextMessage` HTML.
- Local images map through `Slides[*].Background` and `Images[*].Source`; the local audio is referenced by a raw `playAudio` action, but its source slide was not recoverably mapped.
- Manual review is still needed for text embedded directly in image pixels, unlabeled SVG icon meaning, and exact animation/visual sequencing.

## Pages, Screens, and Popups

### 001 - Ocean Wise

- Page/scene number: 1
- Scene ID: `b7755507-87b6-4561-84b4-baede7410f44`
- Original Genially name: `COVER`
- Type: Cover
- Original section: Cover
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `b7755507-87b6-4561-84b4-baede7410f44`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `7f3d4671-62a9-4b19-9220-94249d68e29f` (text):
  - Start
- Text object `ecb3a10a-13ed-4693-8c76-2e2e165dddc1` (Title):
  - Ocean Wise
- Text object `e72184ed-bbda-4044-ad53-9bcf13421a5a` (Subtitle):
  - Your Essential Guide to Snorkelling

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/616955d9-f02b-4aa1-92e1-75e859affb66.jpeg` (source `acc592d9-00a6-44fc-962e-8894507bc433`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on group `cef9a7dc-47c3-4664-928d-1ac80a743b38` (cef9a7dc-47c3-4664-928d-1ac80a743b38): goToSlide: nextPage -> INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)

### 002 - INDEX

- Page/scene number: 2
- Scene ID: `2536ea41-d205-448d-91b8-8fb9a68edebb`
- Original Genially name: `INDEX`
- Type: Main menu
- Original section: Main Menu
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `2536ea41-d205-448d-91b8-8fb9a68edebb`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `c5dc36ce-2167-4c3c-a188-03f1f3cd2599` (title_1):
  - INDEX
- Text object `5b88e83b-32f1-4a0b-8389-bb6735242e48` (Title 2):
  - Introduction
- Text object `f50ec946-9d75-4b88-a30b-1352436dad3a` (Title 2):
  - Equipment
- Text object `b6b0735d-b83f-48fc-8aa1-414d85d40707` (Title 2):
  - Academics
- Text object `ef17bbb2-e376-4aee-988b-c48e09b4c3e7` (Title 2):
  - Open Water
- Text object `dd0473f9-be39-49a6-8dc8-30c78b1672f6` (Title 2):
  - Extra Tips + Resources

#### Media

- background: `images/68353a1c-3741-4d91-b470-2afe5d84149e.jpeg` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `6ed9d8e6-72a7-41c0-9bb4-b70fa8e33747` (svg/SourceSvg;byyeIfxhZB0JKda8zEJVOlgO++KFcSMrfUf7psgtnKI=): goToSlide: Introduction Zone (slide 3, e79cb42c-6a7f-4ea4-bae0-43e48d1086d7)
- click on svg `e2c8506a-bb24-4829-85de-0ab394a98f29` (Introduction Zone ): goToSlide: Introduction Zone (slide 3, e79cb42c-6a7f-4ea4-bae0-43e48d1086d7)
- click on text `5b88e83b-32f1-4a0b-8389-bb6735242e48` (Introduction): goToSlide: Introduction Zone (slide 3, e79cb42c-6a7f-4ea4-bae0-43e48d1086d7)
- click on svg `5661db2c-a397-4ae6-ac45-57376b233aa5` (svg/SourceSvg;E+S7rHZR1YW82RW+IM8AcyDFMnzxR3ldeKWRFrFZmBA=): goToSlide: Equipment Zone (slide 8, 685c8166-0a64-4285-ae2b-f24345fc81cb)
- click on svg `6911af92-c27f-4a55-89cb-c333791ece12` (svg/SourceSvg;tv5iJpoKyQ20ti5pNIZfJzbPXhylcw73Z+LMm0JK/Yg=): goToSlide: Equipment Zone (slide 8, 685c8166-0a64-4285-ae2b-f24345fc81cb)
- click on text `f50ec946-9d75-4b88-a30b-1352436dad3a` (Equipment): goToSlide: Equipment Zone (slide 8, 685c8166-0a64-4285-ae2b-f24345fc81cb)
- click on svg `f733a08f-7762-42ae-8a6e-6cc1e95efa9f` (svg/SourceSvg;E+S7rHZR1YW82RW+IM8AcyDFMnzxR3ldeKWRFrFZmBA=): goToSlide: Academics Zone (slide 13, 4a1a1153-d96b-46e5-bc8e-56205023b0f5)
- click on svg `66561707-6740-4ec0-9c49-f4c235f3ab57` (svg/SourceSvg;tv5iJpoKyQ20ti5pNIZfJzbPXhylcw73Z+LMm0JK/Yg=): goToSlide: Academics Zone (slide 13, 4a1a1153-d96b-46e5-bc8e-56205023b0f5)
- click on text `b6b0735d-b83f-48fc-8aa1-414d85d40707` (Academics): goToSlide: Academics Zone (slide 13, 4a1a1153-d96b-46e5-bc8e-56205023b0f5)
- click on svg `af18940c-bba6-4566-ba43-4e4678ab82ed` (svg/SourceSvg;E+S7rHZR1YW82RW+IM8AcyDFMnzxR3ldeKWRFrFZmBA=): goToSlide: Open Water Zone (slide 20, 52ee1682-bba1-4d0f-be71-a2b7f1ad04aa)
- click on svg `5bbbbfa8-b248-47a0-8f0b-44afb9e3c296` (svg/SourceSvg;tv5iJpoKyQ20ti5pNIZfJzbPXhylcw73Z+LMm0JK/Yg=): goToSlide: Open Water Zone (slide 20, 52ee1682-bba1-4d0f-be71-a2b7f1ad04aa)
- click on text `ef17bbb2-e376-4aee-988b-c48e09b4c3e7` (Open Water): goToSlide: Open Water Zone (slide 20, 52ee1682-bba1-4d0f-be71-a2b7f1ad04aa)
- click on svg `ad43ab44-6ad0-403e-a46d-da693b64dcad` (svg/SourceSvg;E+S7rHZR1YW82RW+IM8AcyDFMnzxR3ldeKWRFrFZmBA=): goToSlide: Extra Tips & Resources (slide 26, de4221be-3fc1-4006-bb0e-58a4e7965ac6)
- click on svg `fe4aa3c6-d548-4af4-ac99-afa8077b127a` (svg/SourceSvg;tv5iJpoKyQ20ti5pNIZfJzbPXhylcw73Z+LMm0JK/Yg=): goToSlide: Extra Tips & Resources (slide 26, de4221be-3fc1-4006-bb0e-58a4e7965ac6)
- click on text `dd0473f9-be39-49a6-8dc8-30c78b1672f6` (Extra Tips + Resources): goToSlide: Extra Tips & Resources (slide 26, de4221be-3fc1-4006-bb0e-58a4e7965ac6)

### 003 - Introduction Zone

- Page/scene number: 3
- Scene ID: `e79cb42c-6a7f-4ea4-bae0-43e48d1086d7`
- Original Genially name: `INDEX Copy`
- Type: Section menu
- Original section: Introduction
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `e79cb42c-6a7f-4ea4-bae0-43e48d1086d7`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `1a0d7eac-0322-4c12-9ed5-7917df6db239` (Title 2):
  - Introduction Zone
- Text object `97b8c3a8-10b7-4d9f-8800-91251d59ac02` (Title 2):
  - History &Interesting facts
- Text object `11283255-1b15-4445-ba56-ae2524577caf` (Title 2):
  - An introduction to our world
- Text object `8b58b052-2268-4bfc-8727-f03341aa4f09` (Title 2):
  - The Golden Rules
- Text object `572ea599-49fc-4269-81ca-bc6830c901f5` (Title 2):
  - Health First

#### Media

- background: `images/68353a1c-3741-4d91-b470-2afe5d84149e.jpeg` (source `slide.Background`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `2e642d2a-76ef-4c0d-94cf-d2753724b965`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `2d689a35-b15a-4001-abb3-aa0b0946ab7e` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `97b8c3a8-10b7-4d9f-8800-91251d59ac02` (History &Interesting facts): goToSlide: History and interesting Facts (slide 5, fd2d94f6-207d-46a1-a04a-9a20b2aba452)
- click on text `11283255-1b15-4445-ba56-ae2524577caf` (An introduction to our world): goToSlide: Introduction to our world (slide 4, 0fa70a3f-d3cb-4c50-8f6f-f585dd9d5f86)
- click on svg `6bca8ef9-d7ef-4a7f-9ac1-44a39324a401` (svg/SourceSvg;Bv3PSs5nRPQtChCZ9iM+ze0CI/geKR5DvPKRSkTtqtk=): goToSlide: History and interesting Facts (slide 5, fd2d94f6-207d-46a1-a04a-9a20b2aba452)
- click on svg `5ae0fa25-1c23-464d-8a77-ed2e7fa18c68` (svg/SourceSvg;7wmJqw0RNhn0j6IpAAc8XAa2OoTBSz2QqE2DlHjZy/Y=): goToSlide: Introduction to our world (slide 4, 0fa70a3f-d3cb-4c50-8f6f-f585dd9d5f86)
- click on text `8b58b052-2268-4bfc-8727-f03341aa4f09` (The Golden Rules): goToSlide: The Golden Rules (slide 7, 4b5bd7a8-f063-4005-bc34-1e1a055ed3e9)
- click on text `572ea599-49fc-4269-81ca-bc6830c901f5` (Health First): goToSlide: Medical Clearances: Ensuring a Safe Dive (slide 6, b2c58a6e-5921-4f2d-899c-f42fd57fa515)
- click on image `2e642d2a-76ef-4c0d-94cf-d2753724b965` (./images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png): goToSlide: The Golden Rules (slide 7, 4b5bd7a8-f063-4005-bc34-1e1a055ed3e9)
- click on svg `377634f9-4573-47a0-afbd-ea05255387eb` (svg/SourceSvg;cLv1NNyDdBHemX19q2hWT/J032xPXjuf9dbxC/RAoqo=): goToSlide: Medical Clearances: Ensuring a Safe Dive (slide 6, b2c58a6e-5921-4f2d-899c-f42fd57fa515)

### 004 - Introduction to our world

- Page/scene number: 4
- Scene ID: `0fa70a3f-d3cb-4c50-8f6f-f585dd9d5f86`
- Original Genially name: `TEXT + IMAGE`
- Type: Content page
- Original section: Introduction
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `0fa70a3f-d3cb-4c50-8f6f-f585dd9d5f86`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `4250b752-befc-469d-b09a-078e1d3ffa89` (text):
  - Introduction to our world
- Text object `dcf7bd63-87d7-4058-9146-0204095c8cc0` (subtitle):
  - Welcome, everyone! My name is Jack , and I'll be your guide today.
  - Let me give you a quick overview. Snorkeling is a fantastic way to explore the coastal underwater world. Armed with minimal equipment you can jump from land to the oceans reefs for an adventure! We will use a prescription mask, to help us see, a snorkel to breathe from, then we could use fins for extra propulsion (but you don’t have to). The key is having comfortable and suitable gear to help you explore the oceans' wonders.
- Text object `6d0308dc-05d8-49e6-b5a1-ed07fc3dd512` (subtitle):
  - Embracing the Ocean: Your Adventure Starts Here
  - Before we embark on our snorkeling adventure, let's take a moment to go over some key safety aspects and liability. I am a trained Scuba diving instructor Trainer. The advice I give you is from the knowledge and experience I've gained from teaching thousands of courses to a variety of individuals. Please be aware of your own comfort levels and never push yourself to do anything that might cause you or anything else harm, the ocean is a beautiful place but we must respect it. This guide is here to help you become aware of the unknown and embrace your inner explorer. With clarity comes responsibility.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/75e89264-101a-4e1c-9828-01119d2adb9c.jpeg` (source `fba0e8f5-2ff1-4ee7-97ed-17168453eb44`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `6e26cf2e-b49d-41d8-a4b1-7a8e06230195` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)

### 005 - History and interesting Facts

- Page/scene number: 5
- Scene ID: `fd2d94f6-207d-46a1-a04a-9a20b2aba452`
- Original Genially name: `TEXT + IMAGE Copy`
- Type: Content page
- Original section: Introduction
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `fd2d94f6-207d-46a1-a04a-9a20b2aba452`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `c080a65e-f292-476e-90d6-b13d4d2c773a` (text):
  - History and interesting Facts
- Text object `3beac472-df0c-434c-82e0-1337592ce43a` (subtitle):
  - Embark on a journey back in time to uncover the origins of snorkeling, a practice as ancient as swimming itself. Historical records suggest that sponge farmers and pearl divers were among the first to develop rudimentary snorkeling techniques, using hollow reeds to breathe while submerged. Fast forward to the 20th century, snorkeling has evolved with the advent of modern equipment, transforming the way we explore underwater realms.
  - Interesting Fact: Did you know that the word "snorkel" originates from the German word "schnorchel," which was a tube used in submarines to allow fresh air intake from above the surface?
  - .

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/bc511779-2a4c-44b5-8e5c-979f894a638e.png` (source `bfb45a60-7cf9-48b6-975f-3d47471a58a8`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `15e830b8-ceae-47de-9c22-8859acbf2f3c` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)

### 006 - Medical Clearances: Ensuring a Safe Dive

- Page/scene number: 6
- Scene ID: `b2c58a6e-5921-4f2d-899c-f42fd57fa515`
- Original Genially name: `TEXT + IMAGE Copy Copy`
- Type: Content page
- Original section: Introduction
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `b2c58a6e-5921-4f2d-899c-f42fd57fa515`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `ad64e055-770f-41ca-b14d-bdf0de9bd2e1` (text):
  - Medical Clearances: Ensuring a Safe Dive
- Text object `ca16f8d3-1c09-4a3d-a8df-cd2c14dc6a2a` (subtitle):
  - Before we get started, it's essential to ensure everyone is in good physical condition for snorkeling. If you have any medical conditions or concerns, please see a General Practitioner and get a medical. Safety is our top priority, and we want to make sure everyone can enjoy the experience safely.
  - The Snorkeling Readiness Checklist
  - Snorkeling is a relaxing sport but requires a certain level of swimming ability and stamina. As a rough fitness and competence level you should be able to:
  - Float in water that is too deep to stand for 10 minutes.
  - Swim continuously for 200 meters using any swimming stroke or combination of stroke.
  - *If this is something that you are incapable of then we highly recommend swimming lessons to ensure your safety and maximize your enjoyment and progression.
- Text object `5afc06fd-12f6-4b46-9dd8-d79804dcfa9d` (text):
  - Snorkeling with Responsibility: Understanding Liability
- Text object `5ffcdcd6-68d4-4304-a8f5-1ab49560bcd4` (subtitle):
  - Before we hit the water, let me remind you that we are not an agency, anyone is allowed to go snorkeling. We are trying to give you tools to remain safe and have fun. By no means are we saying once you read this you are safe, you must stay attentive to yourself and surroundings at all times. We are not to blame if you encounter a problem. We will happily try to help you solve problems if you message us. Enter the water at your own risk.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `f9d6b3bf-e84e-4cfb-942f-1d12f1e1e8be` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)

### 007 - The Golden Rules

- Page/scene number: 7
- Scene ID: `4b5bd7a8-f063-4005-bc34-1e1a055ed3e9`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy`
- Type: Content page
- Original section: Introduction
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4b5bd7a8-f063-4005-bc34-1e1a055ed3e9`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `c373fc8b-32da-4d13-84e3-11531c400a78` (text):
  - The Golden Rules
- Text object `f43e139b-a449-44ef-bfe0-343f085e8335` (subtitle):
  - Before we dive in, let me go over some golden rules of snorkeling.
  - First and foremost,
  - Never snorkel alone: Always buddy up with a partner and keep visual contact with each other throughout the dive.
  - Take a signaling device: Whistle and dry bag or float!
  - Don't rush! Mistakes happen when we're moving too quickly, take your time and be there in the present!
  - Know your limits: Don't get peer pressured into anything that will cause you stress.
  - Don't harass touch or disturb any marine life
  - Know the difference: Know how to spot rock, corals and dead corals (that should still be treated like live corals.)
  - Stay hydrated
  - Don't go too far
  - Be aware of environmental conditions (tides, currents, changes)

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/e491c579-cb15-4dbc-86f2-99265182daa0.jpeg` (source `28257ac9-fb87-414b-8cf7-f1cc6f57ea8b`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `3c376f6f-36c3-4c2e-8bc5-7a1512cbf55b` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)

### 008 - Equipment Zone

- Page/scene number: 8
- Scene ID: `685c8166-0a64-4285-ae2b-f24345fc81cb`
- Original Genially name: `INDEX Copy Copy`
- Type: Section menu
- Original section: Equipment
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `685c8166-0a64-4285-ae2b-f24345fc81cb`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `a5477525-8543-4173-a03c-0aeb35b22f50` (Title 2):
  - Equipment Zone
- Text object `ddc2f191-b980-4c4b-a9eb-1bb93e12ad31` (Title 2):
  - Masks
- Text object `d12f4824-d61c-4463-baef-4d1fd983711f` (Title 2):
  - Snorkels
- Text object `6e877b25-86fc-4f9a-9a0e-5097757d3b6c` (Title 2):
  - Safety Devices
- Text object `cccccb4f-32c5-48aa-9185-3a2735e879f3` (Title 2):
  - Fins
- Text object `71f1a0bc-29dd-4052-ba4d-d7d74dbe53ba` (Title 2):
  - Exposure Suits

#### Media

- background: `images/68353a1c-3741-4d91-b470-2afe5d84149e.jpeg` (source `slide.Background`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `7d74a954-a072-4f54-9ddd-7e4e04f52f97`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `4a47e8a7-20e6-43d1-9d93-9e612a5c581e`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `5abaa290-a3a6-4f52-84d4-26f71ac29e29`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `80586c58-5314-474c-892e-903ccea140a9`)
- image: `images/fb683485-f068-40bd-96a0-6ea301103c61.png` (source `d6af7db4-1554-4a2d-9262-ad901e0d603b`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `a9fb551a-7d92-46e6-aba6-a6d1c3a1f5af` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on image `7d74a954-a072-4f54-9ddd-7e4e04f52f97` (./images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png): goToSlide: Masks (slide 9, 8f3aefff-31c9-46b0-823f-11fd7bbc2dc0)
- click on image `4a47e8a7-20e6-43d1-9d93-9e612a5c581e` (./images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png): goToSlide: Snorkels (slide 10, 6a513533-a765-4061-a1e1-fc9e4f297b9c)
- click on text `6e877b25-86fc-4f9a-9a0e-5097757d3b6c` (Safety Devices): goToSlide: Safety Devices (slide 11, 45e5d06c-c488-4332-8ea8-481685e05063)
- click on text `cccccb4f-32c5-48aa-9185-3a2735e879f3` (Fins): goToSlide: Fins (slide 12, ec7c7e48-22f6-4ac9-bae3-52e913f97478)
- click on image `5abaa290-a3a6-4f52-84d4-26f71ac29e29` (./images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png): goToSlide: Safety Devices (slide 11, 45e5d06c-c488-4332-8ea8-481685e05063)
- click on image `80586c58-5314-474c-892e-903ccea140a9` (./images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png): goToSlide: Fins (slide 12, ec7c7e48-22f6-4ac9-bae3-52e913f97478)
- click on text `71f1a0bc-29dd-4052-ba4d-d7d74dbe53ba` (Exposure Suits): slidePopup: Wetsuit (slide 106, c2de140f-be2d-4c97-a65a-bdf345703e6d)

### 009 - Masks

- Page/scene number: 9
- Scene ID: `8f3aefff-31c9-46b0-823f-11fd7bbc2dc0`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy`
- Type: Content page
- Original section: Equipment
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `8f3aefff-31c9-46b0-823f-11fd7bbc2dc0`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `445c0ca5-6c9a-4248-86b2-3c63b23ee4f7` (text):
  - Masks
- Text object `256142c8-ed9d-408e-9496-ae2af5efdce1` (text):
  - 1. Get to know your options
- Text object `ca8e09ab-e453-4952-af41-40da35b3ac08` (subtitle):
  - VS
- Text object `490d4898-071c-46ff-8b5b-ab087bdf204e` (subtitle):
  - Dual Lense
- Text object `792ee263-a183-4df2-9b6f-7f454091e6d0` (subtitle):
  - Mono Lens
- Text object `80f16e31-f79e-4f27-84d8-275272f6d4fd` (subtitle):
  - VS
- Text object `a98a8615-5de9-43ad-b422-040459929117` (text):
  - Blackout Skirt
- Text object `be638de9-1845-4cb6-a452-3af661f8700e` (text):
  - Clear Skirt
- Text object `5f722f2c-0201-4b49-9e11-3d2312280a52` (subtitle):
  - 2. Anti-Fog Treatment
- Text object `9be15756-6fcf-4b81-af5e-dfb6931cc4d9` (subtitle):
  - 3. Buckle Mastery
- Text object `ea5fe542-0fc0-4fc2-aec9-960c627e4ffb` (title_2):
  - 1 vs 2
- Text object `1ff2ea7f-4d23-49bc-b420-5980e1952332` (subtitle):
  - 4. Donning the Mask
- Text object `233eccf7-f5c7-428b-b4c0-612546cfcebb` (subtitle):
  - 5. Mask Positioning
- Text object `30a15bf5-126f-4354-a8de-4a581e87bda9` (subtitle):
  - 6. Comfort Check
- Text object `fa649537-6aaa-4499-9d4f-345d29a488d5` (subtitle):
  - leavecoated mask
- Text object `4ce638d0-6541-47b4-bda9-c648d4e26c8f` (subtitle):
  - 7. After Care

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b2d3cd58-b963-425c-9cff-62c391c3f892` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `37e6f96b-1c22-48af-8acc-0c614bde4e55` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `490d4898-071c-46ff-8b5b-ab087bdf204e` (Dual Lense): slidePopup: Dual Lens (slide 82, 94d68d83-c79d-4679-afd2-1aa15f88d6e6)
- click on text `792ee263-a183-4df2-9b6f-7f454091e6d0` (Mono Lens): slidePopup: Mono Lens (slide 103, bef7c8fb-0185-441b-aba8-92e3d1d559e0)
- click on text `a98a8615-5de9-43ad-b422-040459929117` (Blackout Skirt): slidePopup: Blackout Skirt (slide 34, 069a8224-5d4e-4799-90d3-570e9e5138ac)
- click on text `be638de9-1845-4cb6-a452-3af661f8700e` (Clear Skirt): slidePopup: Clear Skirt (slide 53, 48db78cc-50e3-4ca3-9eb0-331e5e45a516)
- click on svg `04fee7fb-9c6d-4d7e-b7cf-18c946700ae2` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: No More Fog! (slide 61, 5933723c-b437-4c6d-95da-eabd4ca25eb5)
- click on svg `bf26fb73-9f6b-4050-bb9f-514373c80289` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Buckle Mastery (slide 120, e687713a-50f9-4be8-bfca-49490be08f1e)
- click on svg `b3fcec31-af39-4f02-a17b-dfc9dd3816f3` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Donning the Mask (slide 57, 4d3eee3e-fe88-4c3c-b9ec-0138a7f69cde)
- click on svg `a6e7d0fe-3e80-4b8f-9bf4-9d70d6540e68` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Donning the Mask (slide 122, eb2d7afa-9cc8-499b-af4d-ca43bc040b44)
- click on svg `07e1c442-0e01-4242-8502-7500ef33f59c` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Mask Positioning and Adjustment (slide 128, fcf822e2-e7f9-4c81-96dd-1cbdb32434a5)
- click on svg `936c1ea2-9177-45eb-8924-f90db93a4d56` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Mask Comfort Check: (slide 59, 4fbb3ff3-eed2-4bab-b34d-2a472d888a76)
- click on svg `f9a336dd-9d64-461c-bf85-a5d686fa12d6` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: After Care (slide 119, e41ce519-d846-4b62-a179-8185fee0e6e4)

### 010 - Snorkels

- Page/scene number: 10
- Scene ID: `6a513533-a765-4061-a1e1-fc9e4f297b9c`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Equipment
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `6a513533-a765-4061-a1e1-fc9e4f297b9c`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `187a19d2-dc15-4e9c-bfde-d118d2a197b6` (text):
  - Snorkels
- Text object `4069b8ff-24a1-4b40-b0d1-9e5b8132eee7` (text):
  - 1. Get to know your options
- Text object `7e4e0f14-0522-49bf-bfb9-93452d2962ad` (subtitle):
  - Dry Snorkel
- Text object `f4d925f4-a125-480a-9a75-c71220cca3b7` (subtitle):
  - Traditional J-Shape
- Text object `2469a3fa-a792-49d6-b91a-8f3020c81e79` (subtitle):
  - VS
- Text object `f62f0d7c-f427-4843-96cd-5c8996c78b0c` (subtitle):
  - leavecoated mask
- Text object `7814dd49-6d14-405b-b4ad-78ae775cb870` (text):
  - Flexible Snorkel
- Text object `db901e75-75ee-4e96-8b62-d0bce2465ee3` (subtitle):
  - 2. Attatching the Snorkel
- Text object `706c32f6-bac6-4bba-b7da-1b88ead94b6f` (subtitle):
  - 3. Snorkel Placement
- Text object `e548536c-4179-4189-a89c-0a10e04885da` (subtitle):
  - 4. After Care

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/0c66af9e-407f-4a46-8bdc-8b6312d807fb.png` (source `004b69e3-60eb-410a-b2f0-79e656801f44`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `d5ee92fb-d353-47b6-a265-51d0e0d46982` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `7e4e0f14-0522-49bf-bfb9-93452d2962ad` (Dry Snorkel): slidePopup: Dry Snorkel (slide 51, 4471fedb-b070-4564-8f73-135c3f314107)
- click on text `f4d925f4-a125-480a-9a75-c71220cca3b7` (Traditional J-Shape): slidePopup: Traditional J- Shape (slide 111, d31499f4-ca0e-4a8e-b313-7d750d882cdd)
- click on text `7814dd49-6d14-405b-b4ad-78ae775cb870` (Flexible Snorkel): slidePopup: Flexible Snorkel (slide 58, 4f4b7444-1ad5-4aee-8ad2-18ab0e586f9e)
- click on svg `4248eaec-6bd5-43be-84af-36d2fbceba63` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Attatching the Snorkel (slide 44, 2ae864d0-a5e5-468e-86d2-818b9706035b)
- click on svg `c2195f19-c569-4f4d-b743-a28ba37dc15f` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Snorkel Placement (slide 36, 0fd351e0-26e7-44c4-bd45-473de9109629)
- click on svg `4237729e-1ec3-45d7-8824-200359a17446` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: After Care (slide 123, ed668472-fb88-44bf-8eca-f85b23c50bd9)

### 011 - Safety Devices

- Page/scene number: 11
- Scene ID: `45e5d06c-c488-4332-8ea8-481685e05063`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Equipment
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `45e5d06c-c488-4332-8ea8-481685e05063`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `249b4b32-b9f7-41d5-9a57-edbde0f541e0` (text):
  - Safety Devices
- Text object `26f18b8f-43ac-46e6-8bb9-dc20e6620752` (subtitle):
  - Signaling Buoy
- Text object `1528b3a4-bc41-4e35-9bcf-8f4c4236ea46` (subtitle):
  - Whistle
- Text object `fa829506-621b-4324-ae4b-c349507a7241` (text):
  - Life Jacket
- Text object `60e985a5-8d5e-43c5-bfdc-97e6f06e540e` (title_2):
  - By understanding the features and benefits of each snorkeling equipment component, snorkelers can make informed decisions to enhance their comfort, safety, and enjoyment while exploring the underwater world.
- Text object `f14a0c0a-b6d0-405d-a072-62cb6f17303c` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/56228c3f-711e-4594-9f92-856ca106bebe.png` (source `9dd00e79-0001-4d83-8203-86a80f6ae22a`)
- image: `images/69f8e171-2aa8-44f1-967b-50448d47fbac.png` (source `ef1c24a1-57d6-43a4-ac0e-03f904e4e2e9`)
- image: `images/3600966f-79f9-4ee8-a7ab-332b426567ed.png` (source `ee101da4-1053-46e8-af00-4c5ce733ecaa`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b6f1e9f4-6e0a-415e-ada4-d33bd20f9425` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `26f18b8f-43ac-46e6-8bb9-dc20e6620752` (Signaling Buoy): slidePopup: Signaling Buoy (slide 90, a51147b7-11be-4dc9-9f26-104330b2002e)
- click on text `1528b3a4-bc41-4e35-9bcf-8f4c4236ea46` (Whistle): slidePopup: Whistle (slide 99, aeda8274-0c48-44b8-b033-33705e98b1ac)
- click on text `fa829506-621b-4324-ae4b-c349507a7241` (Life Jacket): slidePopup: Life Jacket (slide 48, 3ca3236a-8ab3-45e9-adec-7f68d3085e54)

### 012 - Fins

- Page/scene number: 12
- Scene ID: `ec7c7e48-22f6-4ac9-bae3-52e913f97478`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Equipment
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `ec7c7e48-22f6-4ac9-bae3-52e913f97478`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `1d2422cb-1df1-4df1-a739-5b6da5e031cd` (text):
  - Fins
- Text object `35b73730-7eba-402b-a443-8d001b80acb5` (text):
  - 1. Get to know your options
- Text object `c544b8aa-ac57-4d33-ba09-e4e752bb5330` (subtitle):
  - VS
- Text object `ccb9a9b5-2732-4e01-a092-8a1d8ffd07e7` (subtitle):
  - Open-Heel Fins
- Text object `4f659776-3e38-4588-ad68-2a42e7ce4eb1` (subtitle):
  - Closed Heel Fins
- Text object `4100cd8d-cce8-4547-9cac-46553e05af23` (subtitle):
  - VS
- Text object `eec9bf4e-c6a3-494b-9554-34f8e4b5e5d2` (text):
  - Long Fins
- Text object `b2a9e47f-15ba-46f0-81ff-1a37e6889073` (text):
  - Short Fins
- Text object `cad71f16-3f90-485d-a3cb-eec86ca9f338` (subtitle):
  - 2. After Care

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/ed76763c-b629-44dd-a3db-538223efef93.png` (source `8e559bc6-6471-4dba-8593-d7eaef0d628d`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `d2598709-81c3-43d0-b5bd-2b5125dccb2d` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `ccb9a9b5-2732-4e01-a092-8a1d8ffd07e7` (Open-Heel Fins): slidePopup: Open Heal Fins (slide 105, c2d96665-e9d9-4132-a4f0-c4349226d198)
- click on text `4f659776-3e38-4588-ad68-2a42e7ce4eb1` (Closed Heel Fins): slidePopup: Closed Heel FIns (slide 78, 83c421e7-84be-4ed9-ad68-6c6f74076e03)
- click on text `eec9bf4e-c6a3-494b-9554-34f8e4b5e5d2` (Long Fins): slidePopup: Long Fins (slide 64, 5c5420f6-4500-4a65-a9e6-4151ceeacea8)
- click on text `b2a9e47f-15ba-46f0-81ff-1a37e6889073` (Short Fins): slidePopup: Short Fins (slide 73, 6f618c3a-37e5-4c61-b855-ab22ea1fd048)
- click on svg `c96c61e1-764f-4b33-a5f9-37dcad38a8f9` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: After Care (slide 42, 2704866b-c056-4647-844b-c2dde347ba41)

### 013 - Academics Zone

- Page/scene number: 13
- Scene ID: `4a1a1153-d96b-46e5-bc8e-56205023b0f5`
- Original Genially name: `INDEX Copy Copy Copy`
- Type: Section menu
- Original section: Academics
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4a1a1153-d96b-46e5-bc8e-56205023b0f5`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `2d489df7-e848-4970-b8c8-ab0a0fad2de0` (Title 2):
  - Academics Zone
- Text object `82d460ae-0212-43c1-9dbb-9742db606401` (Title 2):
  - Conservation
- Text object `a832c3be-6e0d-4770-b4f3-8e2f2177e88e` (Title 2):
  - Enviroment
- Text object `dd5032ed-0d95-4ac2-9d05-93e436342d4b` (Title 2):
  - Fins
- Text object `8d3e966b-54d0-4646-a99b-db8490f61ef1` (Title 2):
  - Aquatic Life
- Text object `ace26cbd-bc29-430c-a70b-34b413f70f27` (Title 2):
  - Physics
- Text object `15fc5266-87ef-4b88-b013-b218da7b91e8` (Title 2):
  - Physiology
- Text object `3574e149-3352-4a8b-9d0a-b952adb323ab` (Title 2):
  - Fins
- Text object `a52a8075-9b28-48b8-a765-26cdede366fa` (Title 2):
  - Equalizing

#### Media

- background: `images/68353a1c-3741-4d91-b470-2afe5d84149e.jpeg` (source `slide.Background`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `145518f7-0bc6-4efb-8165-ef22ecf5bae4`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `31c52e60-ea94-4470-a9bf-e2690d678d78`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `5ad91cd6-101f-4509-9ec3-22a8a5daf570` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `82d460ae-0212-43c1-9dbb-9742db606401` (Conservation): goToSlide: Conservation (slide 14, 7ef4c64f-7605-46fd-b86d-f56ba2ce137a)
- click on text `a832c3be-6e0d-4770-b4f3-8e2f2177e88e` (Enviroment): goToSlide: Enviroment (slide 15, 750f0242-85ed-405f-89de-5ff17ca957e7)
- click on svg `4497e53d-8dff-4777-89b2-69eed87fab4c` (svg/SourceSvg;sPXkvHXN6v4LmPkRv8cqob9QOLbydtgu67qmpTdEIAk=): goToSlide: Conservation (slide 14, 7ef4c64f-7605-46fd-b86d-f56ba2ce137a)
- click on svg `9875baf5-de48-4816-8ed3-f99b7dfa01d4` (svg/SourceSvg;PcFh74HsvW/k0lY4P8wJvSAtvbIIEQZ4Jg6jHLiDHEU=): goToSlide: Enviroment (slide 15, 750f0242-85ed-405f-89de-5ff17ca957e7)
- click on text `8d3e966b-54d0-4646-a99b-db8490f61ef1` (Aquatic Life): goToSlide: Aquatic Life (slide 16, 02aa428e-ccc1-44f3-b20f-ec8e83156a26)
- click on text `ace26cbd-bc29-430c-a70b-34b413f70f27` (Physics): goToSlide: Physics (slide 17, 257f584f-9b06-4f58-a067-a80e501cb9aa)
- click on svg `5d676660-51ed-460c-a302-10b3e92b6256` (svg/SourceSvg;ntg2CwgpSTks43WqfboR2tZU8GyjFgzsir2ILgTJWlA=): goToSlide: Physics (slide 17, 257f584f-9b06-4f58-a067-a80e501cb9aa)
- click on svg `3bf6283f-fdc7-4a16-901c-8df1ce584982` (svg/SourceSvg;zCNqpBfNgpA70RD2ryI32xWpx1R5RHAZnhLnKxFcHpw=): goToSlide: Aquatic Life (slide 16, 02aa428e-ccc1-44f3-b20f-ec8e83156a26)
- click on text `15fc5266-87ef-4b88-b013-b218da7b91e8` (Physiology): goToSlide: Physiology (slide 18, 4177d6b5-e600-4c1b-87eb-ed758141f656)
- click on text `a52a8075-9b28-48b8-a765-26cdede366fa` (Equalizing): goToSlide: Equalizing and Decent (slide 19, 8d6bec64-5330-41a7-8538-c156bc52c9ff)
- click on svg `6c421259-9b81-4c6a-974d-e19dce5e5aa6` (svg/SourceSvg;46fLCUrPWVuZalbww4zEPVPA3N8/5Za4l2gWu9khbi0=): goToSlide: Physiology (slide 18, 4177d6b5-e600-4c1b-87eb-ed758141f656)
- click on svg `17c33c20-0a41-465e-9f26-a3b35cd469b7` (svg/SourceSvg;jRk3OakTC1bMYyIF2cTBDo7R5h/oWdrkfcgVRhCxZ7w=): goToSlide: Equalizing and Decent (slide 19, 8d6bec64-5330-41a7-8538-c156bc52c9ff)

### 014 - Conservation

- Page/scene number: 14
- Scene ID: `7ef4c64f-7605-46fd-b86d-f56ba2ce137a`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Academics
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `7ef4c64f-7605-46fd-b86d-f56ba2ce137a`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `16fcde13-dd72-4069-ae0d-90cc0afc85af` (text):
  - Conservation
- Text object `9f0f1c69-6f30-4f68-ae29-7c837ed564c2` (text):
  - The Vitality of Marine Conservation
- Text object `77a69fc6-2764-4393-bc3f-38fdd461b361` (subtitle):
  - As snorkelers, we are privileged visitors to the ocean's living museums. Embracing conservation ensures these treasures endure for future generations. Oceans Optics is committed to marine preservation through initiatives like artificial reef construction and reef restoration projects in Thailand. We invite our community to partake in design competitions and on-site planting events, fostering a collective effort to rejuvenate our oceans.
- Text object `fcebc767-b796-489a-900e-ed796ee1c18c` (subtitle):
  - Why we need Conservation
- Text object `f4b2380f-1f63-499b-aa93-9213e72603de` (subtitle):
  - Ways to Help the Environment
- Text object `7c725b88-8dfc-431f-88e3-968f9ff1574b` (subtitle):
  - Practices we encourage

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/42903996-c98d-4798-8c23-38aacadf3722.png` (source `dea29e78-a81e-47b0-8890-b817f66fad0b`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `8a1493b9-f5e4-4f90-a516-b2dcd55695d2` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `1ad7584d-f462-4e9c-bcd2-30d4fc84bd0b` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Statistics Highlighting the Need for Conservation: (slide 65, 5da666f7-c4dd-4e98-945d-eed220535eec)
- click on svg `1f4bcfaa-23b5-4fd2-954d-24f48d6e0bc0` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Ways to Help the Environment (slide 97, aaf0dccc-dc5b-4f35-88fc-e7a31e67586e)
- click on svg `9684267a-d402-401a-894e-6ce4a39c53ad` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: To safeguard marine life and promote a sustainable future, Ocean Optics encourages the following practices during any underwater activity: (slide 83, 97ea441f-0551-444e-872e-6f05f24c5d39)

### 015 - Enviroment

- Page/scene number: 15
- Scene ID: `750f0242-85ed-405f-89de-5ff17ca957e7`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Academics
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `750f0242-85ed-405f-89de-5ff17ca957e7`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `37da9d84-b506-4bdd-9d02-9bd152a052e9` (text):
  - Enviroment
- Text object `c79405a5-fa9c-47a9-b73d-1e502593a9d3` (text):
  - Understanding water movement is essential for safe and enjoyable snorkeling. Let's explore the factors that influence water dynamics:
- Text object `393fbebb-9dc6-4a63-a032-6e3b83efa62d` (subtitle):
  - 1. Currents
- Text object `cbd9b3f8-b6f7-467a-a25b-1f5650337392` (text):
  - Long Shore Currents
- Text object `541bae64-fb3e-49ba-ba02-b81042947b11` (subtitle):
  - Tidal Currents
- Text object `666177f5-e850-43cf-8ff8-8c9bb35e39a4` (subtitle):
  - Rip Currents
- Text object `d41f1767-8441-454b-a4a7-6418d458740f` (subtitle):
  - 2. Waves
- Text object `d1470818-bc08-4aa7-84d7-c5e9e50ba14c` (subtitle):
  - 3. Tides
- Text object `503ac871-dcb8-4978-9d15-628f4c62b4aa` (subtitle):
  - 4. Surge

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/47e37222-aca1-470b-a7d8-daa439aca550.png` (source `3b4e47ff-5bb5-47c3-85e2-148f701d6187`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `2e6f5056-f745-4b8f-b1ea-7dac5c7d4268` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `e0979c01-21c8-4f64-b473-1fdafd8ffa45` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Currents (slide 62, 5a415b4b-4ba8-42cc-b87d-dbbb25dd7373)
- click on text `cbd9b3f8-b6f7-467a-a25b-1f5650337392` (Long Shore Currents): slidePopup: Longshore Currents (slide 125, f3c193d1-72d9-473e-909a-99284f7b2be4)
- click on text `541bae64-fb3e-49ba-ba02-b81042947b11` (Tidal Currents): slidePopup: Tidal Currents: (slide 38, 10d4940f-de7b-40d7-8244-d2065dc57cac)
- click on text `666177f5-e850-43cf-8ff8-8c9bb35e39a4` (Rip Currents): slidePopup: Rip Currents (slide 67, 613938ec-2e3f-4d15-b1e7-91cc9c57d2fa)
- click on svg `8b0d94e6-2e97-4940-97c0-c7851eb04fc0` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Waves (slide 66, 5e52f612-7d4d-422d-8cd5-93f56f16d4af)
- click on svg `270353f0-08c5-40de-8eb0-5fc023e3c0e3` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Tides (slide 92, a6528720-a8c4-4a23-81a9-72cdbbf34e60)
- click on svg `07037665-8038-4d95-8d06-812ba773473d` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Surge (slide 70, 6843f61e-d8a0-46ea-96f0-6a26e28c8554)

### 016 - Aquatic Life

- Page/scene number: 16
- Scene ID: `02aa428e-ccc1-44f3-b20f-ec8e83156a26`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Academics
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `02aa428e-ccc1-44f3-b20f-ec8e83156a26`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `ebab6e93-1b23-470c-8f39-284f1b18e7cd` (text):
  - Aquatic Life
- Text object `c17bc4a9-ea50-4530-a290-e5d800ac6d79` (subtitle):
  - Fish and Marine Life
- Text object `e885e9c5-4fa5-4a92-aaaa-d7dc2001a699` (subtitle):
  - Cartilaginous fish
- Text object `30b65143-c533-4eb7-b411-93465b482a0e` (subtitle):
  - Bony fish
- Text object `485ded71-c79a-4b62-b57f-36a7049a6c71` (text):
  - Invertebrates
- Text object `8dd536cb-b967-49eb-90e3-78d1f8f0fdb5` (text):
  - Marine mammals
- Text object `7c63c56f-5965-455e-9850-896e2caf334a` (subtitle):
  - Fun Fishy Facts
- Text object `f7dbaf4f-b994-49f6-9705-1f4e53263da5` (text):
  - Corals

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/7941f901-ae87-47e3-b412-5caac976096e.png` (source `249ee6e9-2cd5-48ae-b990-ff5ea3269e37`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b5e5adaf-b13f-44f4-bc36-8107dc808d3a` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `e885e9c5-4fa5-4a92-aaaa-d7dc2001a699` (Cartilaginous fish): slidePopup: Cartilaginous fish (slide 52, 458fa5f4-33fc-4879-b3d0-322c5624296c)
- click on text `30b65143-c533-4eb7-b411-93465b482a0e` (Bony fish): slidePopup: Bony Fish (slide 116, e0c28eda-262c-40dd-a34c-f83c46aa67f6)
- click on text `485ded71-c79a-4b62-b57f-36a7049a6c71` (Invertebrates): slidePopup: Invertebrates (slide 45, 34ee7601-400e-4586-95db-b2f96bf32733)
- click on text `8dd536cb-b967-49eb-90e3-78d1f8f0fdb5` (Marine mammals): slidePopup: Marine mammals (slide 76, 7912be09-1c55-49c2-93f8-69565a8e7f09)
- click on svg `57a397f4-6a0b-4206-8ea4-5a1098df88c5` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Fun Fishy Facts (slide 91, a514a0ac-64e1-4eab-a932-ebe1ba32a0c6)
- click on svg `b5391e1e-dd86-4153-8891-6c1a565666c6` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: What is Coral? (slide 80, 8bbd184f-a24a-4876-af3e-bafc70f0563e)

### 017 - Physics

- Page/scene number: 17
- Scene ID: `257f584f-9b06-4f58-a067-a80e501cb9aa`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Academics
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `257f584f-9b06-4f58-a067-a80e501cb9aa`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `05f8e785-e97a-40db-a5df-b8ebd6cd0df5` (text):
  - Physics
- Text object `680998cc-7847-4a97-9b5d-b7fea79087a9` (subtitle):
  - Buoyancy
- Text object `2cb76378-9cf1-46d2-83d7-59df49fd18d3` (text):
  - Airspaces
- Text object `f9daa905-c8ea-43bf-93b7-b30b4b1c1f35` (subtitle):
  - Sound
- Text object `ac60daad-41c5-498d-8ff4-8952705d2585` (text):
  - Light

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/497e182b-7629-4b69-8382-109cd56049c1.png` (source `7f82f00f-e15d-4742-8116-d3157ff4c6f3`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `d6fdbc8d-5d4a-4bc7-bce3-3e9e88f78784` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `793676bf-91ea-4ee0-8108-e9db8017034f` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `680998cc-7847-4a97-9b5d-b7fea79087a9` (Buoyancy): slidePopup: Buoyancy (slide 121, e765eed6-30de-4954-b7e1-09ff3308ac80)
- click on text `2cb76378-9cf1-46d2-83d7-59df49fd18d3` (Airspaces): slidePopup: Airspaces (slide 94, a67d4640-097c-4b83-a660-8d6ce786167c)
- click on text `f9daa905-c8ea-43bf-93b7-b30b4b1c1f35` (Sound): slidePopup: Sound (slide 49, 414be8c2-8933-44fd-9351-b0e99e1a42c7)
- click on text `ac60daad-41c5-498d-8ff4-8952705d2585` (Light): slidePopup: Light (slide 113, db9cd1c8-834a-451d-9a01-cead44d97ae5)

### 018 - Physiology

- Page/scene number: 18
- Scene ID: `4177d6b5-e600-4c1b-87eb-ed758141f656`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Academics
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4177d6b5-e600-4c1b-87eb-ed758141f656`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `0984efe0-e068-4c2d-9e15-1fa7b4d01a61` (text):
  - Physiology
- Text object `e9725a76-9ed2-4793-88db-3d39d0b9c3e8` (subtitle):
  - Heat Transfer
- Text object `59562b8b-55f0-458e-8086-86982722c120` (text):
  - Hypercapnia
- Text object `6559d28c-c06c-4889-9026-1553934e50ed` (subtitle):
  - Hypocapnia
- Text object `4b657c18-afde-41ed-aa4c-6214150e8b7f` (text):
  - Shallow Water Blackouts
- Text object `509ae25c-9a08-442c-a560-bf17881512c9` (text):
  - CO2 Effects and First Aid

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/a097e3a8-6774-42c0-b92b-9a12d1f648d2.png` (source `5d27ac5b-3c35-46e0-a834-d065c95145d7`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b8513829-ce4e-46b3-aea1-26733c54391a` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `e9725a76-9ed2-4793-88db-3d39d0b9c3e8` (Heat Transfer): slidePopup: Heat Transfer (slide 112, d7144ab4-6c73-4524-bbb2-cac35652af32)
- click on text `59562b8b-55f0-458e-8086-86982722c120` (Hypercapnia): slidePopup: Hypercapnia (slide 114, dc3e6efe-b8a9-4094-b275-ed4218b849b2)
- click on text `6559d28c-c06c-4889-9026-1553934e50ed` (Hypocapnia): slidePopup: Hypocapnia (slide 93, a65b9fbc-51b4-492d-b066-f2f548708678)
- click on text `4b657c18-afde-41ed-aa4c-6214150e8b7f` (Shallow Water Blackouts): slidePopup: Shallow Water Blackouts (slide 85, 9b21d3d9-93c7-4304-8d0f-acd7cd4d2f4d)
- click on text `509ae25c-9a08-442c-a560-bf17881512c9` (CO2 Effects and First Aid): slidePopup: CO2 Effects and First Aid (slide 115, de6be6ae-b826-44d6-be86-c26d5d9015c0)

### 019 - Equalizing and Decent

- Page/scene number: 19
- Scene ID: `8d6bec64-5330-41a7-8538-c156bc52c9ff`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Academics
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `8d6bec64-5330-41a7-8538-c156bc52c9ff`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `476f7832-8781-4654-a55f-b7fec03724b4` (text):
  - Equalizing and Decent
- Text object `f142f4d2-adf2-4544-baee-e25841944489` (text):
  - Importance Of Equalizing
- Text object `0f36695a-a3a2-494e-ac3d-59e28950a8de` (text):
  - Valsalva Maneuver
- Text object `c19d3e75-94f1-4f0d-804b-d867b9d17fdb` (subtitle):
  - Frenzel Maneuver
- Text object `1387c8a7-bcfa-4c11-b1c6-c344abda2fb4` (text):
  - Jaw Wiggle
- Text object `71ede31e-b07c-4189-ae0f-12f83e1a307d` (text):
  - Yawn Method
- Text object `895c5bbf-a7e6-4d6e-b72a-1c65adc62946` (text):
  - Pro Equalisation Tips

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/5df6713f-920c-4800-acc5-a560d5daf161.png` (source `571d9ce2-a065-48d9-8c46-bc40989e2046`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4260a558-b451-48b5-b627-83d8140ab2e1` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `f142f4d2-adf2-4544-baee-e25841944489` (Importance Of Equalizing): slidePopup: Importance of Equalizing (slide 118, e3d4a6a4-3d7d-432c-9ad5-1c23ec9b2876)
- click on text `0f36695a-a3a2-494e-ac3d-59e28950a8de` (Valsalva Maneuver): slidePopup: Valsalva Maneuver: Aka the Nose Pinch Method (slide 54, 491d6636-51d4-468c-986f-bcedfcbd6ba4)
- click on text `c19d3e75-94f1-4f0d-804b-d867b9d17fdb` (Frenzel Maneuver): slidePopup: Frenzel Maneuver (slide 41, 2572985c-7b17-461f-a266-5cecafa84b9d)
- click on text `1387c8a7-bcfa-4c11-b1c6-c344abda2fb4` (Jaw Wiggle): slidePopup: Jaw Wiggle (slide 47, 37de805c-f660-4c13-bcb7-5cc60947bba0)
- click on text `71ede31e-b07c-4189-ae0f-12f83e1a307d` (Yawn Method): slidePopup: Yawn Method (slide 35, 0be660db-d719-47ba-b7be-50ff1928c739)
- click on text `895c5bbf-a7e6-4d6e-b72a-1c65adc62946` (Pro Equalisation Tips): slidePopup: Pro Equalisation Tips (slide 89, a4b9e79b-c327-47ad-8b4f-28e2870b4aef)

### 020 - Open Water Zone

- Page/scene number: 20
- Scene ID: `52ee1682-bba1-4d0f-be71-a2b7f1ad04aa`
- Original Genially name: `INDEX Copy Copy Copy Copy`
- Type: Section menu
- Original section: Open Water
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `52ee1682-bba1-4d0f-be71-a2b7f1ad04aa`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `b199e381-c352-4888-86bf-7b9f120362c8` (Title 2):
  - Open Water Zone
- Text object `3a26828b-41d8-4106-b777-375bf62d0b15` (Title 2):
  - Pre Snorkel
- Text object `a8d49a6a-e0bc-4d45-ac89-953bed07515e` (Title 2):
  - Entry & Exit
- Text object `12f3c2f1-6b07-4e47-aa9b-041537fe06e6` (Title 2):
  - Snorkels & Duck Diving
- Text object `5e262eb0-6146-4a81-8e2a-2a80ee93f649` (Title 2):
  - Kicking Styles
- Text object `fc1dfd29-7274-4a65-8793-389e1028c95f` (Title 2):
  - Fins
- Text object `ab3082be-9c6c-4b2f-a02d-093453eb9e1f` (Title 2):
  - Mask Clearing

#### Media

- background: `images/68353a1c-3741-4d91-b470-2afe5d84149e.jpeg` (source `slide.Background`)
- image: `images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png` (source `7d822c15-772e-4fec-9d7c-27f586269fe4`)
- image: `images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png` (source `4214f249-4942-4574-be14-7ff9b8c09ae0`)
- image: `images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png` (source `e6fe6e95-e415-482c-aeb8-f2abcf79c15f`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `7231e80d-d049-458f-8d92-5a1a505120f3`)
- image: `images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png` (source `381db38d-da13-4f06-bff9-3f940efed0f6`)
- image: `images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png` (source `e1be4e5b-3509-41e8-aaa2-ec31fc44699a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4dc8bd7d-536d-4cb3-b60d-3622b0cda16a` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `3a26828b-41d8-4106-b777-375bf62d0b15` (Pre Snorkel): goToSlide: Pre Snorkel Routine (slide 21, c5a0ef8c-d15c-4e2d-9ca4-655c916935cb)
- click on text `a8d49a6a-e0bc-4d45-ac89-953bed07515e` (Entry & Exit): goToSlide: Entry & Exit (slide 22, 0d80a1d3-dca2-478f-9871-80a7f3561074)
- click on image `7d822c15-772e-4fec-9d7c-27f586269fe4` (./images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png): goToSlide: Pre Snorkel Routine (slide 21, c5a0ef8c-d15c-4e2d-9ca4-655c916935cb)
- click on image `4214f249-4942-4574-be14-7ff9b8c09ae0` (./images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png): goToSlide: Entry & Exit (slide 22, 0d80a1d3-dca2-478f-9871-80a7f3561074)
- click on text `12f3c2f1-6b07-4e47-aa9b-041537fe06e6` (Snorkels & Duck Diving): goToSlide: Snorkels & Duck Diving (slide 23, ff69a575-f48f-43e6-b9b3-4c8df4a249dd)
- click on text `5e262eb0-6146-4a81-8e2a-2a80ee93f649` (Kicking Styles): goToSlide: Kicking Styles (slide 24, 4bdb78ab-147f-4395-8336-9d1b7df381ab)
- click on image `381db38d-da13-4f06-bff9-3f940efed0f6` (./images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png): goToSlide: Kicking Styles (slide 24, 4bdb78ab-147f-4395-8336-9d1b7df381ab)
- click on text `ab3082be-9c6c-4b2f-a02d-093453eb9e1f` (Mask Clearing): goToSlide: Mask Clearing (slide 25, 4858a8aa-a2fe-4cd0-87a6-cde2fc0444a4)
- click on image `e1be4e5b-3509-41e8-aaa2-ec31fc44699a` (./images/2b1f49c8-c3c8-41a7-ba8d-ceeaf71036b3.png): goToSlide: Mask Clearing (slide 25, 4858a8aa-a2fe-4cd0-87a6-cde2fc0444a4)

### 021 - Pre Snorkel Routine

- Page/scene number: 21
- Scene ID: `c5a0ef8c-d15c-4e2d-9ca4-655c916935cb`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Open Water
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `c5a0ef8c-d15c-4e2d-9ca4-655c916935cb`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `d70731a6-7cb8-49bd-aafc-bb929c02e521` (text):
  - Pre Snorkel Routine
- Text object `4c7e4e93-2103-4e44-bdcb-aef739d5df11` (subtitle):
  - leavecoated mask
- Text object `ed09daff-c316-4d32-a154-5e98fc60ba82` (subtitle):
  - 1. Exposure Protection
- Text object `96e74d99-fe8a-4c19-bf99-31f5e722c063` (subtitle):
  - 2. Hair Management
- Text object `8f413e4c-3fb8-46c4-9fe2-5deed3ca030a` (subtitle):
  - 3. Stretch Routine

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/77f63a4c-4ba0-4953-ae2a-58db0ee4809c.jpeg` (source `ad211fe8-bae7-4c44-8204-3ff56e653a1a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `ddb019fd-1e23-4c5a-b09b-b589816fb8dc` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `3dd89af7-fc6c-4100-9b77-e956f83c0fba` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Exposure Protectiom (slide 69, 68177322-3f7e-4132-9bee-48f21676df58)
- click on svg `c43470fb-c8e6-4673-8687-402fd069ef06` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Long Hair: Unwanted and strangling hair can cause unneccesary stress while snorkeling. We reccomend tying the hair back  (slide 117, e2b7ac7e-3325-4a1a-8ce8-df724f90ce43)
- click on svg `5557477d-4493-47f1-abf2-87d7d2f0f89c` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Stretch Routine - Let’s loosen up (slide 68, 66c64710-a555-4b1c-a5e3-da58e5c592a4)

### 022 - Entry & Exit

- Page/scene number: 22
- Scene ID: `0d80a1d3-dca2-478f-9871-80a7f3561074`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Open Water
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `0d80a1d3-dca2-478f-9871-80a7f3561074`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `b09ea378-78ef-4948-9eb7-852a353b850a` (text):
  - Entry & Exit
- Text object `41d97db1-06b6-4271-b39e-158750f53f34` (subtitle):
  - Entry
- Text object `c2ec92de-662e-4874-b09c-e198c1368ef7` (subtitle):
  - Exit
- Text object `07ea6f45-5375-4b8b-9102-10adfbc60674` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/7967074f-66dd-4aed-a2a6-a4efe19e2704.jpeg` (source `7854a60c-a74d-4470-bd09-794008fb11e2`)
- image: `images/22ca2b1c-d4a4-48b6-80ef-4d3d1ab3c6cb.jpeg` (source `bcf1e8b8-07b1-40f6-a54b-0e3d0b93e834`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `5279317e-e59b-43e4-8864-5294cf0cf781` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `9cc558e8-167c-451b-bd0d-6cdfc59dc9c2` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Entry (slide 46, 377efc3f-de05-46bd-8d95-44f59b3fa2ff)
- click on svg `5d63b196-03f1-497a-970f-cb610edc090d` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Exit (slide 126, f7ccea8f-378f-4af9-86db-bc0afc8002ac)

### 023 - Snorkels & Duck Diving

- Page/scene number: 23
- Scene ID: `ff69a575-f48f-43e6-b9b3-4c8df4a249dd`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Open Water
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `ff69a575-f48f-43e6-b9b3-4c8df4a249dd`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `7cdc50b2-5f43-4e67-b1d6-a86712898118` (text):
  - Snorkels & Duck Diving
- Text object `00697ba2-70d2-4b7b-8ada-c7c6864669e7` (subtitle):
  - Snorkel Clearing
- Text object `4c107d5b-b447-4057-b7d3-34adc90205cf` (subtitle):
  - Duck Diving
- Text object `01ad1f0d-bf8a-4d2b-b1f9-b6d3bfa93acb` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/2d262ef9-eeb1-4019-a690-78ce4e80a400.jpeg` (source `100c2f6f-e030-4601-9900-2b93050391a7`)
- image: `images/93f6d898-4290-4e34-8029-d9909337473c.jpeg` (source `b46e0e81-961c-4271-b3cf-917b9c2dc007`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b80ad158-bd12-4ff0-9aea-0aafd6d2e241` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `752db1b0-3458-476e-8a50-d6b51bd20525` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Snorkel Clearing (slide 98, acd0c101-da7b-4d15-ac0a-387c620939de)
- click on svg `57d0d85f-7526-440d-a63b-89170131954b` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Duck Diving (slide 107, c7e00449-6346-4dc9-9733-f32e09fe98ae)

### 024 - Kicking Styles

- Page/scene number: 24
- Scene ID: `4bdb78ab-147f-4395-8336-9d1b7df381ab`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Open Water
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4bdb78ab-147f-4395-8336-9d1b7df381ab`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `52915196-5edc-4f4f-8de9-1f13df44842d` (text):
  - Kicking Styles
- Text object `6b6a153a-50f7-4521-a716-c0cf29bfc21d` (subtitle):
  - Flutter Kick
- Text object `1ba4cf66-0af4-4460-a216-58447579e0ac` (subtitle):
  - Frog Kick
- Text object `7b519a96-5291-4da7-9a0a-91ad4a08d48f` (subtitle):
  - leavecoated mask
- Text object `1736bf62-d531-4f3f-880b-1783656d4153` (subtitle):
  - Straight Leg Kick
- Text object `61ed9022-755c-4ae7-8d0f-4e2eb1f1eedb` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/286fe107-9682-4f7d-89ab-4f4ca8ff3d19.jpeg` (source `cc1eba1f-1f14-4cec-86cc-48d811b84fb5`)
- image: `images/f2bf4f3c-978e-4d59-a5a3-50eabeae3b6e.jpeg` (source `a7353c18-4482-40da-afe4-47c5d8a1e72e`)
- image: `images/f3ea8ee4-21a7-4f98-82f5-9b9199e9803d.jpeg` (source `72c7e0fd-b9c9-4659-95dc-15d50120ab14`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `d6a1ec21-45ad-46b7-b12b-3e22c4253dd1` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `c7b8f704-15b5-47c6-809c-3a3626b53216` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Flutter Kick (slide 108, c8c53c1c-ffb2-40b7-b094-68cdc1aa8f4b)
- click on svg `d7d3baee-ddd7-44bb-a7cc-00e81e96e31e` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Frog Kick (slide 96, aa6fdcd7-5059-4670-b3fd-454e7269ed39)
- click on svg `c5b0ee83-c4e4-4b64-a22f-e07e4c03fcec` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Straight Leg Kick (slide 40, 185e2912-064f-488b-8a93-0404aa827501)

### 025 - Mask Clearing

- Page/scene number: 25
- Scene ID: `4858a8aa-a2fe-4cd0-87a6-cde2fc0444a4`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Open Water
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4858a8aa-a2fe-4cd0-87a6-cde2fc0444a4`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `e885cbb7-d3bd-43dd-8f0b-5982002e3a5c` (text):
  - Mask Clearing
- Text object `9ec0459e-c03f-4d0b-9d94-c4f115107b7e` (text):
  - If water gets into your mask, don't worry – here are some easy ways to remove it without having to take the mask off and continue your dive without interruption.All you have to do is blow out of your nose. Here's a few different techniques for holding the mask to suit your style.
- Text object `9764e1c2-72a9-4834-a49a-4f6d42815ed5` (subtitle):
  - Technique # 1
- Text object `60393d01-af61-4755-b920-da14e05b93e4` (subtitle):
  - Technique # 2
- Text object `8893e62e-9589-4c6b-a379-e930a230ec0e` (subtitle):
  - Technique # 3

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/841541a7-4415-473c-a2bb-a3c3fbeb931d.jpeg` (source `a15066e9-e6b8-4d7e-b468-8e8a37f019ac`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `7967bbda-4161-4a00-8ec3-f66829112d90` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `9764e1c2-72a9-4834-a49a-4f6d42815ed5` (Technique # 1): slidePopup: Two Hand Method (slide 100, af3abd10-6ca1-4912-a2b1-78c4df95bccf)
- click on text `60393d01-af61-4755-b920-da14e05b93e4` (Technique # 2): slidePopup: One Hand Tilt (slide 74, 76f423b6-af0a-4dca-a5bd-19ee238566d4)
- click on text `8893e62e-9589-4c6b-a379-e930a230ec0e` (Technique # 3): slidePopup: Heal of Hand Press (slide 127, fb948d14-f6ac-47f9-9242-389cc68ef290)

### 026 - Extra Tips & Resources

- Page/scene number: 26
- Scene ID: `de4221be-3fc1-4006-bb0e-58a4e7965ac6`
- Original Genially name: `INDEX Copy Copy Copy Copy`
- Type: Section menu
- Original section: Extra Tips & Resources
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `de4221be-3fc1-4006-bb0e-58a4e7965ac6`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `bc802725-ae44-41cf-93ac-7b03a461dfbc` (Title 2):
  - Extra Tips & Resources
- Text object `73b9de88-0e10-4b63-ba37-f37d7d7feb1f` (Title 2):
  - Effective Communication
- Text object `9b65d13d-9a47-4cfe-b256-5200fe79278b` (Title 2):
  - Understanding Beach Flags
- Text object `b3179f53-2cb1-4ff7-af1d-c7c5cdb8c17b` (Title 2):
  - The Snorkelers Checklist
- Text object `53e886a7-0715-4fee-bb19-ff4ea9aeee93` (Title 2):
  - Swimming Techniques
- Text object `ad075fdf-bb68-4b54-9469-086f651f5b51` (Title 2):
  - Fins
- Text object `40a88447-c79c-4d08-8849-66020334f047` (Title 2):
  - Types of Snorkeling
- Text object `d76f8b52-dcc1-4b84-9d07-f286b191c886` (Title 2):
  - First Aid Essentials
- Text object `78797999-1100-40d3-a987-8117b0af9cd0` (Title 2):
  - Fins

#### Media

- background: `images/68353a1c-3741-4d91-b470-2afe5d84149e.jpeg` (source `slide.Background`)
- image: `images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png` (source `5813dea8-336c-4faf-89c5-8510e8035e6c`)
- image: `images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png` (source `c61676b1-270d-4578-805a-bf9f50facdd9`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `4d97dc86-c7af-41a2-b579-51ea4fc79504`)
- image: `images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png` (source `631a5c52-7a66-4c41-a479-ae83ec6e522a`)
- image: `images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png` (source `bb9689fa-2235-4af1-b495-0f0a99334ee2`)
- image: `images/9328f6f4-1ee2-42c1-af72-7c850a9a92ca.png` (source `ac67293e-ed6b-4db8-9e27-5e113620d3ad`)
- image: `images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png` (source `2ef14e46-46a2-48d0-9ee6-7091075d805a`)
- image: `images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png` (source `3f32b5a3-16e8-4f65-a1c9-6477fb649647`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `37fb3f57-611b-4434-b9cd-d516568600c8` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `73b9de88-0e10-4b63-ba37-f37d7d7feb1f` (Effective Communication): goToSlide: Effective Communication (slide 28, 1587d94c-66c3-4164-8764-62bc434c330e)
- click on text `9b65d13d-9a47-4cfe-b256-5200fe79278b` (Understanding Beach Flags): goToSlide: Beach Flags (slide 27, f170bc2a-e4f1-4422-8612-c8105bb62915)
- click on image `5813dea8-336c-4faf-89c5-8510e8035e6c` (./images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png): goToSlide: Effective Communication (slide 28, 1587d94c-66c3-4164-8764-62bc434c330e)
- click on image `c61676b1-270d-4578-805a-bf9f50facdd9` (./images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png): goToSlide: Beach Flags (slide 27, f170bc2a-e4f1-4422-8612-c8105bb62915)
- click on text `b3179f53-2cb1-4ff7-af1d-c7c5cdb8c17b` (The Snorkelers Checklist): goToSlide: Snorkelling Safety Checklist (slide 29, caa2b2f2-6aba-4799-94c1-d7ca1e2c768f)
- click on text `53e886a7-0715-4fee-bb19-ff4ea9aeee93` (Swimming Techniques): goToSlide: Swimming Techniques (slide 30, 638abb6b-b0da-4104-847d-b6c778576da1)
- click on image `631a5c52-7a66-4c41-a479-ae83ec6e522a` (./images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png): goToSlide: Swimming Techniques (slide 30, 638abb6b-b0da-4104-847d-b6c778576da1)
- click on image `bb9689fa-2235-4af1-b495-0f0a99334ee2` (./images/a4b294fa-f82b-45b7-b3aa-104bd20ba6f0.png): goToSlide: Snorkelling Safety Checklist (slide 29, caa2b2f2-6aba-4799-94c1-d7ca1e2c768f)
- click on text `40a88447-c79c-4d08-8849-66020334f047` (Types of Snorkeling): goToSlide: Types of Snorkeling (slide 31, b93fcb35-7f32-4533-a59b-7406170bd2c7)
- click on text `d76f8b52-dcc1-4b84-9d07-f286b191c886` (First Aid Essentials): goToSlide: First Aid Essentials for Snorkeling (slide 32, 6a5e7d6f-15fd-4a92-87d0-f65ce7909cc1)

### 027 - Beach Flags

- Page/scene number: 27
- Scene ID: `f170bc2a-e4f1-4422-8612-c8105bb62915`
- Original Genially name: `27`
- Type: Content page
- Original section: Extra Tips & Resources
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `f170bc2a-e4f1-4422-8612-c8105bb62915`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `ea8e4889-e07d-4b6a-bcaf-61affc2e7348` (title_2):
  - Beach Flags
- Text object `7b31a118-1b67-4b82-a4a8-6fbbde17f179` (subtitle):
  - Yello w
- Text object `8a44b65c-f734-4b60-aadb-612e97f3c74b` (subtitle):
  - Red
- Text object `fc2f5115-6075-499b-8510-7321b2479722` (subtitle):
  - Red Over Red
- Text object `81ed28df-5e5d-4535-a6a9-67c8d8c0a14a` (subtitle):
  - Purple
- Text object `5f5ee792-cfeb-4966-b861-d9d1afb3dd80` (subtitle):
  - Red over Yellow
- Text object `fc155b0e-293d-4a04-b292-83bba69244b7` (subtitle):
  - Black and White
- Text object `8d7f8c80-5797-405c-b745-f58287ec99f1` (subtitle):
  - Yellow and Black
- Text object `f48f5d3b-5b43-4be2-9125-8c90895c4637` (subtitle):
  - Orange Wind Sock
- Text object `247be8a9-1265-4eea-ba6d-5d01b90f113e` (subtitle):
  - Red and White

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/117a285b-302b-4f86-a185-d2e955b6d2a4.png` (source `feb1a41b-f8f8-49ba-a372-d9ea97026b2c`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `1d7f1a04-f84b-4a24-9a7e-ce57b1312d6e` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on text `7b31a118-1b67-4b82-a4a8-6fbbde17f179` (Yello w): slidePopup: Meaning: Medium hazard. (slide 104, c27bad6c-b91f-496e-a6d8-bd55c372e622)
- click on text `8a44b65c-f734-4b60-aadb-612e97f3c74b` (Red): slidePopup: Meaning: high hazard. (slide 101, b546f9b6-49df-46d6-a02e-42cd03c0a811)
- click on text `fc2f5115-6075-499b-8510-7321b2479722` (Red Over Red): slidePopup: Meaning: Closed to Public. (slide 63, 5c2d3897-8474-4003-9005-8174ec8a2794)
- click on text `81ed28df-5e5d-4535-a6a9-67c8d8c0a14a` (Purple): slidePopup: Meaning: Marine Pests Present (slide 39, 183a3385-9168-4c0a-8b06-98a23d2f02a5)
- click on text `5f5ee792-cfeb-4966-b861-d9d1afb3dd80` (Red over Yellow): slidePopup: Meaning: Reccomened simming area, with life guard supervision. (slide 75, 772bbad3-537a-4fa7-a9a1-9d7f22537916)
- click on text `fc155b0e-293d-4a04-b292-83bba69244b7` (Black and White): slidePopup: Meaning: Watercraft area. (slide 86, 9cda9d97-1723-4d22-bd05-248f5d8d6133)
- click on text `8d7f8c80-5797-405c-b745-f58287ec99f1` (Yellow and Black): slidePopup: Meaning: watercraft use prohibited. (slide 55, 49651412-dcfd-4b47-84fc-1e02d9b74556)
- click on text `f48f5d3b-5b43-4be2-9125-8c90895c4637` (Orange Wind Sock): slidePopup: Meaning: Offshore winds present, inflatables should not be used. (slide 77, 8244fe2f-6fbe-438c-9718-90cbb7fd4b37)
- click on text `247be8a9-1265-4eea-ba6d-5d01b90f113e` (Red and White): slidePopup: Meaning: emergency evacuation. (slide 56, 49ced45f-e63f-434c-93f7-a568c884da35)

### 028 - Effective Communication

- Page/scene number: 28
- Scene ID: `1587d94c-66c3-4164-8764-62bc434c330e`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Extra Tips & Resources
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `1587d94c-66c3-4164-8764-62bc434c330e`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `cb3e2aef-1f9e-47ce-ae95-7650517cec77` (text):
  - Effective Communication
- Text object `9e4b31e5-063f-427e-bca9-fe420b6a0993` (title_2):
  - Communicating while snorkeling can be dificult. We reccomend reviewing common hand signals with your buddy before your adventure. This will not only make communicating easier, it can also make it more fun!
- Text object `453c0243-eff3-4922-b04b-7ecb4612ad25` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/1c8c82ca-f7f5-40b9-8b90-c403ba823c4b.png` (source `4877a145-b9ed-477d-a5f5-12b2e80706d7`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `49fff3f2-d26c-4028-855f-e867e7c96f1d` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)

### 029 - Snorkelling Safety Checklist

- Page/scene number: 29
- Scene ID: `caa2b2f2-6aba-4799-94c1-d7ca1e2c768f`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Extra Tips & Resources
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `caa2b2f2-6aba-4799-94c1-d7ca1e2c768f`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `b51ebeb8-1976-4295-ae5f-7307cf66ec4a` (title_1):
  - Snorkelling Safety Checklist
- Text object `caf0cd89-3c4e-48b1-8ea3-5335c4c95878` (subtitle):
  - PRE SNORKEL - SWIM PREPARATION
  - Sunscreen
  - Thermal protection/Sting protection.
  - Hydrated with lots of water.
  - Hair tied back and clear of face.
  - Checked for dive flags.
  - Planned your entry and exits
  - Inquired about potential hazards ( and read our guide on hazards)
  - Pre swim stretch routine
  - INSPECT YOUR MASK:
  - Lens - Glass not cracked
  - Frame - Nothing ripped or broken
  - Seal - Check the soft silicone for tears or cracks.
  - INSPECT YOUR SNORKEL
  - Mouthpiece - Nothing chewed off.
  - Purge valve - Exhaust cover valve there, open and closes correctly
  - Dry top - Check operation and closes off the air supply when submerged.
  - Grab a flotation device, and go have some fun!
- Text object `ac7088e8-8281-46c8-be77-b7d8fb0293b7` (title_2):
  - Extra safety recommendations
- Text object `9ece36c0-23b1-4290-8ec9-ef767b0b58af` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `74db2a8d-f135-43d3-8f4b-0d3f4770cf70` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `00f8c413-5cc2-49a2-82e6-38ea74656877` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: EXTRA SAFETY RECCOMENDATIONS (slide 33, 060aa4d7-7db8-4a00-8118-f0a4ea9d4cbe)

### 030 - Swimming Techniques

- Page/scene number: 30
- Scene ID: `638abb6b-b0da-4104-847d-b6c778576da1`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Extra Tips & Resources
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `638abb6b-b0da-4104-847d-b6c778576da1`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `135fa3eb-9aad-42c1-9e8e-cc72b3e162a4` (text):
  - Swimming Techniques
- Text object `a4632102-680b-40aa-94f4-73ee3b926b29` (subtitle):
  - Breath Control and Movement
- Text object `29acdee7-75fc-40aa-92df-9581102e6357` (subtitle):
  - Speed and Motion
- Text object `0b419d8d-b4d0-4b0d-acfc-923dd18af3a1` (subtitle):
  - Floating and Treading Water
- Text object `cea7e782-50e5-423b-8169-882dd8556057` (subtitle):
  - Treading Water Life Saving
  - tips
- Text object `d91fcf41-041a-4eac-94aa-bad05b143058` (subtitle):
  - Breaststroke
- Text object `a51a7de8-cc36-4d0a-81df-cd4657d8698f` (subtitle):
  - Freestyle Swimming
- Text object `aa5192d1-27a7-4edd-b67b-5966315d1395` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/94abd7d5-0fb6-40d1-9a6f-aa5ae573406e.jpeg` (source `7e094b70-088e-4b57-9870-d2ad3c65ee06`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `6415e3e8-2709-4e97-8ec2-928b36a5207d` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `d0bcde4b-4cac-4d60-b9b6-cc80f67d69b4` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Breath Control and Movement: Enhancing Your Snorkeling Performance (slide 87, 9e4ba789-3efe-4494-8bb2-4e092fec6bab)
- click on svg `8bc04d90-9068-4141-8fc4-4a5e99a8ab8d` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Speed and Motion: How to move efficiently. (slide 60, 500d3593-9c5c-48bc-8276-c3b354f087a6)
- click on svg `135f9e89-1ca1-4844-91ae-629f2f84e619` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Floating and Treading Water: Essential Surface Skills (slide 124, f36b8b53-66ef-445c-ae49-bab0f237b4e2)
- click on svg `bcf1d187-4b8c-40fa-affa-120479d2395a` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Treading Water Life Saving tips: (slide 129, fe015cf2-28ce-45d8-9b6d-2cdcf0663b6f)
- click on svg `b457b2b1-7295-4d9c-a3e4-7c43faf4fb39` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Breaststroke: Grace and Efficiency (slide 50, 41daa1a5-255d-464e-8378-6d830b88b8af)
- click on svg `fe0bd2e0-8043-4790-9030-527fdb21ac4d` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Freestyle Swimming: Speed and Streamlining (slide 71, 6b29d187-2f5f-4582-9faf-576c3f07f42b)

### 031 - Types of Snorkeling

- Page/scene number: 31
- Scene ID: `b93fcb35-7f32-4533-a59b-7406170bd2c7`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Extra Tips & Resources
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `b93fcb35-7f32-4533-a59b-7406170bd2c7`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `9399dd17-e220-429c-8ca0-f39a7dce7248` (text):
  - Types of Snorkeling
- Text object `1801150c-8316-41f3-81dc-17dce9c27616` (subtitle):
  - Reef Snorkeling:
- Text object `4aa4ebb2-2a9d-4b92-a7b6-2c39c76301e2` (subtitle):
  - Wreck Snorkeling:
- Text object `df9dfc9b-a8c9-4a40-ba2e-d081246bd910` (subtitle):
  - Wall Snorkeling:
- Text object `7f89f867-7b27-4198-a197-d1c039ea774f` (subtitle):
  - Sand Snorkeling:
- Text object `5ba70bc8-09d3-4952-a57d-a272031b6a43` (subtitle):
  - Artificial Reef Snorkeling:
- Text object `8fe86650-281e-482f-afe5-b55df5ab0b2d` (subtitle):
  - leavecoated mask
- Text object `50bb7064-3630-427b-891f-72c2051091ec` (subtitle):
  - Each type of snorkeling presents its own set of challenges and rewards. Whether you're drawn to the colorful reefs, the mystery of shipwrecks, or the tranquility of sandy bottoms, there's a snorkeling experience waiting to captivate your senses and ignite your passion for underwater exploration. Take the plunge and discover the wonders that lie beneath the surface!

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/42ac2c44-28ee-4b7b-abf6-94896e09a5e1.jpeg` (source `6256199c-8da4-47d1-9f7b-526971481233`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `38feefe5-9b39-4559-8850-437eb58b123c` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `ef70f404-7b0a-4887-bfd8-5667d3335302` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Reef Snorkeling: (slide 72, 6eecdfe6-34d8-477c-a7e6-ee75dce4c901)
- click on svg `997ca152-979c-4a12-bc22-e028757f5377` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Wreck Snorkeling: (slide 43, 27be8c79-7f33-47bc-bf74-c9aa05912fc7)
- click on svg `68599079-5107-489b-9a2d-c4ee6140cb42` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Wall Snorkelling (slide 37, 10098fce-2832-4644-a4e4-6d6372132b18)
- click on svg `85d75eb6-30f8-426b-b8fd-3cc4a55b5e1b` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Sand Snorkelling (slide 81, 9213c0f5-93d2-4384-9717-fcc5d19070ef)
- click on svg `0ecd83d5-5ee2-4569-a2bf-5fa0f5c13e51` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Artificial Reef Snorkeling: (slide 102, b590d7ad-3cc3-472f-9ddc-0d1678d4ada6)

### 032 - First Aid Essentials for Snorkeling

- Page/scene number: 32
- Scene ID: `6a5e7d6f-15fd-4a92-87d0-f65ce7909cc1`
- Original Genially name: `TEXT + IMAGE Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Content page
- Original section: Extra Tips & Resources
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `6a5e7d6f-15fd-4a92-87d0-f65ce7909cc1`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `a8804898-1569-45e4-8454-3dc1faa02d89` (text):
  - First Aid Essentials for Snorkeling
- Text object `5f9bbca7-4f99-4cf7-b4fb-444349ceabad` (subtitle):
  - Cardiopulmonary Resuscitation (CPR)
- Text object `223d3034-8d58-4df5-8ca2-5ecce8240c3e` (subtitle):
  - Chest Compressions
- Text object `1f7da046-8d79-4f72-838c-2539160f5249` (subtitle):
  - Rescue Breaths
- Text object `40f03bf3-6a30-405b-b5ca-d16b29315328` (subtitle):
  - Drowning
- Text object `887fe740-2d39-4996-b6e7-855f04d00f9a` (subtitle):
  - Basic First Aid
- Text object `b97e2cdb-8d5e-4f89-b81d-9470e14c274c` (subtitle):
  - Additional First Aid:
- Text object `0157904e-9f11-4eb7-b86a-cbe755cedccb` (subtitle):
  - leavecoated mask

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/5712d309-8ef2-40d3-9198-26153a91e429.png` (source `c6859700-010f-4ea5-bca5-346d787a9351`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `a1791bea-a0e6-4775-b1b2-e62d52db461c` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `bdb69962-4e21-413c-98f3-3925e937ceb6` (svg/SourceSvg;3MYUlPPDvhk7SHc77Olz4+QwFrB0tvjHTF3BUNkPfGM=): goToSlide: INDEX (slide 2, 2536ea41-d205-448d-91b8-8fb9a68edebb)
- click on svg `b7c34561-0a2d-4ae0-b7b8-2af76774a0b1` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Cardiopulmonary Resuscitation (CPR): (slide 110, cf93506b-45c5-452b-83da-dc3999b647a9)
- click on svg `37256acd-c682-4376-96fd-a6b355c6d968` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Chest Compressions: (slide 88, a24684be-aa01-4fde-82d0-63125a1b9638)
- click on svg `79198bd6-cf5f-473f-bd61-f428419f8b18` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Rescue Breaths: (slide 84, 9996eeeb-a46b-4f77-9b10-f4fb82f5769d)
- click on svg `bdd99554-f63f-4c1d-bf55-6856d7afbe7b` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Drowning: (slide 95, a92e90cd-1c3d-4563-9ea3-b959e6e30e52)
- click on svg `c0370535-445a-4be6-868f-3486b980f9d8` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Jellyfish Stings: (slide 109, caf92656-9305-4997-938f-1aa0c4496ee7)
- click on svg `f709dcbb-0540-4a9b-8378-a1aea8cf4cae` (svg/SourceSvg;it5FkYXWcRT9WmVtHXQXQJcKu0u2xSiNW1oYa3Q+kXI=): slidePopup: Treat minor cuts and bruises with antiseptic wipes and adhesive bandages. (slide 79, 89d83254-5d00-4e02-953f-f28b7cfea566)

### 033 - EXTRA SAFETY RECCOMENDATIONS

- Page/scene number: 33
- Scene ID: `060aa4d7-7db8-4a00-8118-f0a4ea9d4cbe`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Snorkelling Safety Checklist (slide 29, action `MnqAv3szjWHxq76v8aXa0`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `060aa4d7-7db8-4a00-8118-f0a4ea9d4cbe`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `dabea366-e32f-46d4-ac16-7eb096f991eb` (title_2):
  - EXTRA SAFETY RECCOMENDATIONS
- Text object `024e2570-3dcd-4ded-90d9-c362c1cc3688` (subtitle):
  - Buddy System: Always snorkel with a partner and establish a safety check system.
  - Breathing Control: Practice taking deep, slow breaths to maintain a light, steady pace.
  - Regular Breaks: Remove your snorkel mask at least once every 30 minutes to breathe fresh air.
  - Environmental Awareness: Check for riptides, currents, and other water conditions beforehand.
  - Wildlife Precautions: Do not touch marine life to avoid harm to both the environment and yourself.
  - Avoid Alcohol and Drugs: Never snorkel under the influence as it impairs judgment and physical ability.
  - Know Your Limits: Recognize your physical capabilities and do not overexert yourself.
  - Remember to always follow the manufacturer's guidelines for using snorkel masks and never ignore any discomfort or signs of panic. For more detailed information and safety guidelines, you can refer to the resources provided by Divers Alert Network and Seaview 180.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `fcfa50e0-2336-4635-9d53-0bf33aee41ac` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 034 - Blackout Skirt

- Page/scene number: 34
- Scene ID: `069a8224-5d4e-4799-90d3-570e9e5138ac`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `aCn-LTs9rBh_QSqnUxa0h`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `069a8224-5d4e-4799-90d3-570e9e5138ac`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `f6e5cab1-4ffe-471a-bd73-c40d52896007` (title_1):
  - Blackout Skirt
- Text object `dcfebeef-eba5-4b80-ba32-cd76d5dc181c` (content):
  - Perfect for tropical climates and bright environments, the blackout seal skirt blocks unwanted light from entering the mask, helping to focus vision and reduce glare.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/8b0d855f-e4e5-473a-8ab2-b047f6bf9816.png` (source `548bf1f7-dd8d-430c-b9a0-487d90b81ff4`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `cad97450-f0c3-460a-99b8-711b95bbac37` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 035 - Yawn Method

- Page/scene number: 35
- Scene ID: `0be660db-d719-47ba-b7be-50ff1928c739`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Equalizing and Decent (slide 19, action `CvTQumT47ZUwSvbdQQfgp`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `0be660db-d719-47ba-b7be-50ff1928c739`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `10f65bc0-9887-4400-80b0-235c84596a7c` (title_1):
  - Yawn Method
- Text object `17b9ef7f-5804-470e-94ca-d515007fcbc7` (content):
  - Simulate a yawn by opening your mouth wide and stretching your jaw muscles.
  - This action can help open the Eustachian tube and equalize pressure in the middle ear.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `ac9d3c69-bba0-41de-91c2-b636563a6f4b` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 036 - Snorkel Placement

- Page/scene number: 36
- Scene ID: `0fd351e0-26e7-44c4-bd45-473de9109629`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Snorkels (slide 10, action `GjDoyoC6hXxEBCGR8VYZD`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `0fd351e0-26e7-44c4-bd45-473de9109629`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `8a409242-ec6f-4b79-81fd-12896bfa1d98` (title_1):
  - Snorkel Placement
- Text object `cacc98e4-d074-4fd8-9b44-fd9453cac928` (content):
  - Position the snorkel on the right side of your head, aligning it with your dominant hand for ease of access and use.
  - Adjust the angle of the snorkel so that it slopes upwards towards the surface of the water when worn.
  - Comfort and Functionality:
  - Experiment with different strap tensions and snorkel angles to find the most comfortable and functional position for you.
  - Ensure the snorkel mouthpiece is positioned comfortably in your mouth, allowing for easy breathing and minimal jaw strain.
  - Water Level:
  - Position the snorkel tip just above the water's surface when floating face down, ensuring that it remains dry and free from water ingress.
  - Avoid submerging the snorkel completely underwater, as this can lead to water entering the snorkel tube and impeding breathing.
  - Head Positions:
  - Practice maintaining a relaxed and neutral head position while snorkeling, with your face parallel to the water's surface.
  - Avoid tilting your head too far forward or backward, as this can cause water to enter the snorkel or disrupt your field of vision.
  - Remember to periodically check and readjust your equipment as needed throughout your snorkeling adventure for optimal comfort and safety.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/1716e47c-11bb-4252-9a98-7b0978ea6b5d.png` (source `da456e97-08a2-4212-a69a-461e25ef3989`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `02ea8974-722c-48ca-99b0-a12da2376bc3` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup
- click on image `da456e97-08a2-4212-a69a-461e25ef3989` (./images/1716e47c-11bb-4252-9a98-7b0978ea6b5d.png): zoom: source element czdIzdWdrwwASs13jxkeG

### 037 - Wall Snorkelling

- Page/scene number: 37
- Scene ID: `10098fce-2832-4644-a4e4-6d6372132b18`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Types of Snorkeling (slide 31, action `O9Fz2xSdah-mrhw607PzG`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `10098fce-2832-4644-a4e4-6d6372132b18`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `1b275857-25f4-4ea3-9802-efe833e3f498` (title_1):
  - Wall Snorkelling
- Text object `447b4454-8141-4194-9ec2-fab8e0ad9f59` (content):
  - Experience the awe-inspiring beauty of underwater walls or drop-offs. These vertical formations offer dramatic views and the chance to see pelagic species like sharks, rays, and large schools of fish. Snorkel along the edge of the wall to observe the transition from shallow to deep water and enjoy encounters with both reef and open ocean species.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/138482dd-6f06-4997-b48a-71b6afe5176e.png` (source `37d746b6-84da-4048-a2d9-f33304f8e604`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `04ed0fd4-3e7c-4731-9527-226bd596cd5e` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 038 - Tidal Currents:

- Page/scene number: 38
- Scene ID: `10d4940f-de7b-40d7-8244-d2065dc57cac`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Enviroment (slide 15, action `4p6pdG4ZldHsyqzix6bsR`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `10d4940f-de7b-40d7-8244-d2065dc57cac`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `bee6bfe0-c7a7-4696-bba8-174d930e977e` (title_1):
  - Tidal Currents:
- Text object `bea9a2e4-58df-4673-950f-9a49c0f9994b` (content):
  - These currents result from the gravitational interactions between the Earth, moon, and sun, leading to rising and falling tides. Tidal currents can be predictable and significantly impact nearshore water movement.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/ef296fe5-53c9-4ec0-a029-2fe1058195f3.png` (source `f1255221-a03c-48ba-b9d3-f8d7109aaaf4`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `fad8debc-7343-4012-935a-e413fedb8a90` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 039 - Meaning: Marine Pests Present

- Page/scene number: 39
- Scene ID: `183a3385-9168-4c0a-8b06-98a23d2f02a5`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `zHnPyQj2FKfFZe-bUWvtU`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `183a3385-9168-4c0a-8b06-98a23d2f02a5`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `2f8e329c-85f6-48a3-9771-720d12d3a94a` (text):
  - Meaning: Marine Pests Present

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `f58a2968-d51c-4470-a65a-d2c659e94054` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 040 - Straight Leg Kick

- Page/scene number: 40
- Scene ID: `185e2912-064f-488b-8a93-0404aa827501`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Kicking Styles (slide 24, action `r9NuzSA8tgX6RxCxynken`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `185e2912-064f-488b-8a93-0404aa827501`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `de6f5114-b922-4843-97df-a514eee1420f` (title_2):
  - Straight Leg Kick
- Text object `0f60a821-8d0a-44bb-8ea9-e747d1da1ebe` (title_1):
  - Performing a straight leg kick while snorkeling is a technique that involves keeping your legs straight and using your hips to generate power. Here's a description of how to execute this type of kick:
  - Position Your Body: Lie flat in the water on your stomach, face down, with your body in a straight line from head to toe.
  - Leg Alignment: Keep your legs straight without bending at the knees. Your toes should be pointed to streamline your body and reduce drag.
  - Initiate the Kick: Begin the kick from your hips, allowing the movement to flow down to your feet. Your hips are the driving force behind the straight leg kick, not your knees or ankles.
  - Fluid Motion: Use a fluttering motion with your feet, keeping the movement small and rapid. It's similar to the action you'd use to gently kick off your sheets when lying in bed.
  - Even Rhythm: Maintain an even pace with your kicks. They should be consistent and rhythmic, contributing to steady propulsion through the water.
  - Breathing: Coordinate your breathing with your kicking. Inhale quickly through your snorkel when your face is in the water, and exhale when you turn your head to the side if needed.
  - Remember, the straight leg kick is all about maintaining a balance between power and efficiency. It should be a controlled, sustainable movement that propels you forward without causing early fatigue. If you're new to snorkeling, practice this technique in shallow water or a swimming pool until you're comfortable with the motion and can maintain it for the duration of your snorkeling adventure.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/53f0bfd3-42bd-4c89-a93f-bc862516a2f9.gif` (source `da604d66-1a06-4a45-8f48-4289b2ad256d`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `84303eab-dd42-4dbc-8f3e-f3ec355f9fdd` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 041 - Frenzel Maneuver

- Page/scene number: 41
- Scene ID: `2572985c-7b17-461f-a266-5cecafa84b9d`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Equalizing and Decent (slide 19, action `2MHqbESMJGbHmHlXn3gvz`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `2572985c-7b17-461f-a266-5cecafa84b9d`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `1f4d6e06-dace-4e28-b14d-890d1d438a82` (title_1):
  - Frenzel Maneuver
- Text object `6143fc2c-be80-4946-92d5-d1cb670acf04` (content):
  - Pinch your nose as with the Valsalva maneuver. Instead of blowing out forcefully, make the sound of the letter "K" while trying to blow through your nose. This technique is a more controlled way to equalize pressure in the middle ear.
  - .

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `093b7bab-a298-4233-95d7-7c2388756bc7` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 042 - After Care

- Page/scene number: 42
- Scene ID: `2704866b-c056-4647-844b-c2dde347ba41`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Fins (slide 12, action `_XN-SPgpjA4uhng9gyUS2`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `2704866b-c056-4647-844b-c2dde347ba41`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `74f2d4b3-a1b7-48ef-b7f8-f3b8ad9b374b` (title_1):
  - After Care
- Text object `0a265afe-1b8b-476e-86db-4fed725ab30b` (subtitle):
  - Rinse fins thoroughly with fresh water.
  - Scrup with a non abbrasive dish soap and toothbrush, if any gunk is present.
  - Allow fins to dry compleatly before storing
  - Avoid drying the fins in direct sunlight.
- Text object `0213de62-91d4-4142-9ecf-cb22cbc2bf7e` (title_1):
  - Mold Prevention
- Text object `15529f82-65f4-4b42-bf6f-45f9b2c61d36` (subtitle):
  - Ensure the fins are fully dry before storing.
  - If mold is found, soak the fins in white vinegar, then scrub with a soft brush.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/0b292779-7e10-4bbd-9a7f-d29fe5db4c64.png` (source `31ae12c5-3ba2-40f6-b693-2b04ae61ea26`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4b25aa23-e1ab-40ef-86ad-28bf36944939` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 043 - Wreck Snorkeling:

- Page/scene number: 43
- Scene ID: `27be8c79-7f33-47bc-bf74-c9aa05912fc7`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Types of Snorkeling (slide 31, action `Yre7CMZxfwtexsRuTCbTa`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `27be8c79-7f33-47bc-bf74-c9aa05912fc7`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `d808a3d2-186f-41a2-a4ab-896ef7e9c9b6` (title_1):
  - Wreck Snorkeling:
- Text object `6978d499-f360-457f-b1de-ef1eead0a2dc` (content):
  - Discover sunken ships, planes, or other submerged structures. Wreck snorkeling provides an opportunity to explore underwater history and encounter marine life that has made these artificial habitats their home. Keep in mind that wreck sites may require more advanced snorkeling skills and experience.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/1240e694-5b12-4d5c-91db-b9e9e3a9ce82.png` (source `d07165da-58dd-40ab-a0db-e8499c6e0bfb`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `ed977902-33d3-4c9d-827b-262230a6775b` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 044 - Attatching the Snorkel

- Page/scene number: 44
- Scene ID: `2ae864d0-a5e5-468e-86d2-818b9706035b`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Snorkels (slide 10, action `AsIPNGwwqXOm5Bp106olo`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `2ae864d0-a5e5-468e-86d2-818b9706035b`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `07a9283c-9999-44e2-bbb6-af90c9e0e9df` (title_1):
  - Attatching the Snorkel
- Text object `99124da0-b005-4367-ba0c-d66184335bbc` (content):
  - Before venturing into the water, it's essential to properly attach your snorkel to the mask strap and ensure a comfortable fit for optimal snorkeling experience.
  - Positioning: Locate the snorkel keeper or clip on the mask strap, typically found at the back of the mask. Slide the snorkel through the snorkel keeper until it rests securely against the strap.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `3116855a-80f1-4a9c-9cc9-667c652d46b8` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 045 - Invertebrates

- Page/scene number: 45
- Scene ID: `34ee7601-400e-4586-95db-b2f96bf32733`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Aquatic Life (slide 16, action `MK36xFQLe90wBucsnMVNo`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `34ee7601-400e-4586-95db-b2f96bf32733`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `ce6ba011-8e7c-4c8d-9731-d02a920c81eb` (title_1):
  - Invertebrates
- Text object `0fa06d64-f389-48d2-9e1a-0b1b5f06bc29` (content):
  - They have no backbones, and they come in a wide variety of shapes, sizes, and colors. From colorful sea stars and spiny sea urchins to delicate jellyfish and intricate coral polyps, invertebrates play essential roles in marine ecosystems. Take your time to explore the nooks and crannies of the reef to discover these fascinating creatures.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/45011e75-1793-46ba-b549-24d5d13c3585.png` (source `108795f7-2a97-4877-9db7-696acdf5f1b0`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `d839a43e-27f3-40af-a6bc-0aab95549993` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 046 - Entry

- Page/scene number: 46
- Scene ID: `377efc3f-de05-46bd-8d95-44f59b3fa2ff`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Entry & Exit (slide 22, action `Z0J8RvCziMumzmJt4TWDn`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `377efc3f-de05-46bd-8d95-44f59b3fa2ff`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `e61cf2b4-105d-47e2-af8a-5b69e58c4a2c` (title_2):
  - Entry
- Text object `bb8703a3-8875-4714-959c-4a47691edb05` (title_1):
  - Now, let's talk about how to enter the water safely and efficiently. Whether we're wading in from the shore or stepping off a boat, we want to make sure we enter without causing disturbance to the underwater environment or harm to ourselves.
  - Wade in:
  - Keep your fins in your hands, walk in enough to sit down. Sit and put your fins on, make sure your mask and snorkel are clean, adjusted and ready. Put your face on the surface and check to make sure it's clear to start swimming.
  - Deep water:
  - If it's a deeper water entry then it's best to be in all your gear before getting to the edge. Once ready, line up your toes with the edge, with your right hand hold your pushing the mask and snorkel towards your face and use the other hand to hold the back of the mask strap. 1, 2, 3 take a big step forward and let your other leg follow. Try not to jump, skip or hop. (it can be slippery.)
  - Boat:
  - Depends on the boat but you could do the deep water entry like above or use the ladder and lower yourself down into the water.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `5bac534a-45ba-464f-86de-84f9b92c4aeb` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 047 - Jaw Wiggle

- Page/scene number: 47
- Scene ID: `37de805c-f660-4c13-bcb7-5cc60947bba0`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Equalizing and Decent (slide 19, action `sFZA6wTviayFpFqOljFrS`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `37de805c-f660-4c13-bcb7-5cc60947bba0`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `9f00fbc7-72c4-469a-b714-16a59f471cfb` (title_1):
  - Jaw Wiggle
- Text object `aa14ad98-b17c-4c76-b7b0-574fdc5c4c03` (content):
  - Move your jaw from side to side and back and forth while keeping your mouth closed. This movement helps to open the Eustachian tube and facilitate pressure equalization.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b28d0475-28f0-46e8-86b9-8ff6c9e1e240` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 048 - Life Jacket

- Page/scene number: 48
- Scene ID: `3ca3236a-8ab3-45e9-adec-7f68d3085e54`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Safety Devices (slide 11, action `kGf1fT-xGry0ia0wVyVEo`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `3ca3236a-8ab3-45e9-adec-7f68d3085e54`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `45b0d101-1cd0-4c90-8718-e64a6e68f2bf` (title_1):
  - Life Jacket
- Text object `b8bff9a3-e6e5-4b26-9964-34f4ff96b61b` (content):
  - Suitability:
  - Recommended for weaker swimmers or challenging conditions, providing essential buoyancy and flotation support. Offers peace of mind and adds safety during snorkeling excursions.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `bd01dcb2-eeb6-45de-b911-175d7a6d9091` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 049 - Sound

- Page/scene number: 49
- Scene ID: `414be8c2-8933-44fd-9351-b0e99e1a42c7`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physics (slide 17, action `AqnP6MyPQUsJyi3cKmSxk`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `414be8c2-8933-44fd-9351-b0e99e1a42c7`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `261003d2-8d9e-40d8-abe0-eea62cff6fd2` (content):
  - Underwater, sound travels 4 x faster than in air but is challenging to pinpoint in terms of direction due to the density and pressure of water. This phenomenon affects communication between divers and can impact situational awareness.
- Text object `38abe5f0-8b9d-421f-a4eb-27358d806472` (title_1):
  - Sound

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/506ede2a-9ab5-431f-8c58-30e01c55bd6d.png` (source `5579f2ff-ee66-482a-aaa3-030fdb7564b0`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `19ce74f3-ff09-4eec-a9ba-abdd965b99c7` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 050 - Breaststroke: Grace and Efficiency

- Page/scene number: 50
- Scene ID: `41daa1a5-255d-464e-8378-6d830b88b8af`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Swimming Techniques (slide 30, action `putPNoPRl1N4GAYr9qcR3`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `41daa1a5-255d-464e-8378-6d830b88b8af`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `de194a12-cad9-452c-953f-7fc0d5724683` (subtitle):
  - Breaststroke: Grace and Efficiency
  - Starting Position: Begin in a relaxed position with your body floating horizontally in the water. Keep your head facing forward and your arms extended in front of you.
  - Arm Movement: Start the stroke by pulling your arms outward and then bending them at the elbows, bringing your hands toward your chest. As your hands reach your chest, rotate your palms outward and sweep your arms outward and backward in a circular motion.
  - Leg Movement:
  - Simultaneously, perform a frog kick by bending your knees outward and bringing your heels toward your buttocks. Then, kick your legs outward and backward in a circular motion, similar to a frog's kick. Finish the kick by straightening your legs and bringing them together.
  - Breathing:
  - Lift your head slightly out of the water to take a breath as your arms complete the outward sweep. Exhale as your arms pull back together and your face returns to the water.
  - Timing:
  - Coordinate your arm and leg movements so that they work together in a smooth, rhythmic motion. Your arms and legs should move in sync, with one cycle of the stroke for every breath you take.
  - Breastroke Tips:
  - Keep your body streamlined and avoid excessive splashing to minimize resistance.
  - Focus on maintaining a steady pace and rhythm throughout the stroke.
  - Practice proper breathing technique to ensure you get enough air without disrupting your stroke.
  - Common Mistakes:
  - Dropping your elbows too low during the pull phase, which can cause drag and slow you down.
  - Kicking too forcefully or too slowly, which can disrupt your balance and rhythm.
  - Holding your breath instead of exhaling steadily while your face is in the water, which can lead to fatigue and discomfort.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/eb473f5f-e598-4fbc-ab30-e1248c1ea97c.gif` (source `d3ec011e-8335-47fc-bbfb-151297db1a5a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `f43ac389-644a-44e2-b019-654dac64a47f` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 051 - Dry Snorkel

- Page/scene number: 51
- Scene ID: `4471fedb-b070-4564-8f73-135c3f314107`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Snorkels (slide 10, action `f7D1sGdGyyrR8T5H4DmkH`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4471fedb-b070-4564-8f73-135c3f314107`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `639619a0-5b3d-46af-83c4-1d8bd4527512` (title_1):
  - Dry Snorkel
- Text object `d06a4d55-da9d-4245-b787-f5d3d5c29447` (content):
  - Benefits: Features a float and cover at the top to prevent water ingress, providing a dry breathing experience. Purge exhaust style allows for effortless water clearing.
  - Drawbacks: May be slightly bulkier and more expensive than traditional snorkels.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/2e2e82bc-e224-493d-9b1c-f9132711c7df.png` (source `5def3d75-3c07-4601-90a9-81a3f9d54375`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `97e6c43d-d695-43e5-9d75-103632d32ebe` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 052 - Cartilaginous fish

- Page/scene number: 52
- Scene ID: `458fa5f4-33fc-4879-b3d0-322c5624296c`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Aquatic Life (slide 16, action `43nOQKFDgxYye-l0D_LPc`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `458fa5f4-33fc-4879-b3d0-322c5624296c`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `9a7a88cd-b671-4059-a700-584fd796095a` (title_1):
  - Cartilaginous fish
- Text object `c0754dae-41da-48da-81ca-0c4c4910f865` (content):
  - Such as sharks and rays, have skeletons made of cartilage rather than bone. They're known for their sleek, streamlined bodies and powerful swimming abilities. Keep an eye out for their distinctive shapes and behaviors, like the graceful gliding of rays or the swift movements of sharks.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/346851d2-b308-4925-98a0-38c4fae86d12.png` (source `fa5e83d4-abb1-4315-8cb2-27c60fda95ac`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `bb6ff61b-8a07-4293-9494-fe139f0515ea` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 053 - Clear Skirt

- Page/scene number: 53
- Scene ID: `48db78cc-50e3-4ca3-9eb0-331e5e45a516`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `wv-gkn8tNGv_URxYWNNAy`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `48db78cc-50e3-4ca3-9eb0-331e5e45a516`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `7c67cf18-d489-45f7-b850-305486cbfa55` (title_1):
  - Clear Skirt
- Text object `7c183d8a-2fba-4a28-b819-a9b1809c4ea5` (content):
  - Suitable for darker, murkier waters where maximizing light penetration is essential. However, be cautious of reflections that may occur in bright conditions, potentially obstructing visibility.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/4c82f1bd-aa6f-402a-b5f2-c9c24c85d975.png` (source `c76a6829-c252-4f65-ac39-211722ffb9dd`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `dfe51ad6-919b-4922-a559-1e912577793b` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 054 - Valsalva Maneuver: Aka the Nose Pinch Method

- Page/scene number: 54
- Scene ID: `491d6636-51d4-468c-986f-bcedfcbd6ba4`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Equalizing and Decent (slide 19, action `ZD1E1JMh2hylmyG2FbCXS`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `491d6636-51d4-468c-986f-bcedfcbd6ba4`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `d4e7b471-d57d-4af6-bf71-a53ef5bf5229` (title_1):
  - Valsalva Maneuver: Aka the Nose Pinch Method
- Text object `bf2c0a1f-a7ae-4d5b-9f8a-2c5c99168726` (content):
  - Pinch your nose with your thumb and forefinger. Close your mouth and gently blow out through your nose, as if trying to blow through your pinched nose. This maneuver helps to open the Eustachian tube and equalize pressure in the middle ear.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b47fa9fd-83fd-4755-9bd2-42f7795b9d5a` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 055 - Meaning: watercraft use prohibited.

- Page/scene number: 55
- Scene ID: `49651412-dcfd-4b47-84fc-1e02d9b74556`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `rzQxaMHTO3UjJAZswrkCw`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `49651412-dcfd-4b47-84fc-1e02d9b74556`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `fd90e9f3-2eef-46b8-8b12-f293ddf4ca14` (text):
  - Meaning: watercraft use prohibited.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `47903128-9a08-4c6d-8fbb-819131c876e8` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 056 - Meaning: emergency evacuation.

- Page/scene number: 56
- Scene ID: `49ced45f-e63f-434c-93f7-a568c884da35`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `188pmKlvZ16CwbmLfQlwo`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `49ced45f-e63f-434c-93f7-a568c884da35`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `9f9d8b1b-bbac-44f6-a6e5-babc00c4c56d` (text):
  - Meaning: emergency evacuation.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `02bd6e32-86cc-429f-bcfa-c15408304e3e` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 057 - Donning the Mask

- Page/scene number: 57
- Scene ID: `4d3eee3e-fe88-4c3c-b9ec-0138a7f69cde`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `fJjZVuoV6x4OzK2vakS_x`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4d3eee3e-fe88-4c3c-b9ec-0138a7f69cde`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `5c6ddfaa-ff9a-4f01-9c8d-3c56e08bec63` (title_1):
  - Donning the Mask
- Text object `9cdd9f16-1b5d-420c-9abd-52c27a55a235` (content):
  - Before putting on the mask, it's essential to loosen the straps to prevent discomfort.
  - Mask Placement:
  - Place the mask's seal against your face, ensuring that it covers your nose completely without obstructing the top lip.
  - Gently slide the strap over the back of your head, being mindful of the mask's buckles, which can be fragile.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/c6648fab-626d-4a96-93be-5ea637b1ecf9.gif` (source `e6aa61f6-60ed-4d49-88e3-a279cab7df9c`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4a040fa2-e011-4f67-bdcd-c28e0ccdb343` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 058 - Flexible Snorkel

- Page/scene number: 58
- Scene ID: `4f4b7444-1ad5-4aee-8ad2-18ab0e586f9e`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Snorkels (slide 10, action `nuxPJZoBSGUpnBNiu9GTo`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4f4b7444-1ad5-4aee-8ad2-18ab0e586f9e`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `cfc947ae-12d6-4f86-8f7c-a6a68dcf0804` (title_1):
  - Flexible Snorkel
- Text object `7d5e7e87-46fa-4299-9ebc-b53078ef9e04` (content):
  - Benefits: Adjustable mouthpiece improves comfort and reduces jaw fatigue.
  - Drawbacks: May offer less direct airflow than rigid snorkels. Can be harder to clear than the purge style.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/fce77a06-572d-4f9e-a5a1-8f886a3037c6.png` (source `2aa72e4d-daa0-419a-97f7-1a1e0e9986d9`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `142e523b-de99-4e64-b969-1e214a1741eb` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 059 - Mask Comfort Check:

- Page/scene number: 59
- Scene ID: `4fbb3ff3-eed2-4bab-b34d-2a472d888a76`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `ZZbIeSfg887skKehg1wVM`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `4fbb3ff3-eed2-4bab-b34d-2a472d888a76`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `7b394d9e-1405-4fc2-ba77-b93392399dcf` (subtitle):
  - Mask Comfort Check:
  - You should be able to comfortably pull the mask 1-2 cm away from your face without feeling any discomfort or pressure.
  - Ensure that the mask's seal does not dig into your face, as this can cause irritation and discomfort during your snorkeling adventure.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/60bdc5b1-dead-4820-9ec0-3323f89422af.gif` (source `4a4d5afe-9b37-4d87-8be7-69bcb0e6a146`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `c02ad3e8-9398-4168-b981-055100094cbc` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 060 - Speed and Motion: How to move efficiently.

- Page/scene number: 60
- Scene ID: `500d3593-9c5c-48bc-8276-c3b354f087a6`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Swimming Techniques (slide 30, action `WSrAFw9eiJH95zZnNDlfe`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `500d3593-9c5c-48bc-8276-c3b354f087a6`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `71cb1655-6e99-40c5-b785-a6509ffcc256` (title_1):
  - Speed and Motion: How to move efficiently.
- Text object `ce3efbd6-dbcd-4ba5-8327-467c1179f8b4` (content):
  - As you become more comfortable in the water, experiment with different speeds and motions to enhance your snorkeling experience. Practice gliding effortlessly through the water, using your fins to propel yourself forward with minimal effort. By mastering speed and motion, you'll cover more ground and see more of the underwater world around you.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `de38d73c-6b4d-4592-ab49-674681b779cf` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 061 - No More Fog!

- Page/scene number: 61
- Scene ID: `5933723c-b437-4c6d-95da-eabd4ca25eb5`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `nd9YYfbEYqDy2MPugE9m9`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `5933723c-b437-4c6d-95da-eabd4ca25eb5`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `090572f8-1fa3-4ebd-b41a-c640d410c1c3` (title_1):
  - No More Fog!
- Text object `abf8a69e-c9cb-480e-8c7c-4de3f1d0f6a6` (content):
  - Apply white toothpaste on the inside lens. Massage thoroughly, then rinse out.
  - Repeat 2-3 times, then leave coated mask overnight.
  - Wash the mask with dishsoap to remove all the toothpaste.
  - If the mask continues to fog, repeat steps 1-3.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/2a4e5367-571b-45ea-b8ed-30292269e136.png` (source `008412a2-2845-40a4-8859-e076a320adde`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `f6a2d89c-ce7b-4a19-9fce-233ebbf47539` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 062 - Currents

- Page/scene number: 62
- Scene ID: `5a415b4b-4ba8-42cc-b87d-dbbb25dd7373`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Enviroment (slide 15, action `0Ck9gJp6HmiKO5gXCY7XK`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `5a415b4b-4ba8-42cc-b87d-dbbb25dd7373`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `e15ddb84-7752-4fdc-b981-917c9aa4e0b2` (title_1):
  - Currents
- Text object `64cffe70-9541-4dd3-8ea6-4c962eec7be0` (content):
  - Ocean currents are streams of water moving in a consistent direction, influenced by various environmental factors. Recognizing and understanding these currents is crucial for snorkelers to ensure safety and effective navigation.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `761d8030-5ddc-44bd-8481-40d711cad141` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 063 - Meaning: Closed to Public.

- Page/scene number: 63
- Scene ID: `5c2d3897-8474-4003-9005-8174ec8a2794`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `WsLKs3rzTLxFhm_lBCQkJ`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `5c2d3897-8474-4003-9005-8174ec8a2794`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `fbc4404a-1a8b-4e3c-83f8-b017d78c0222` (text):
  - Meaning: Closed to Public.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `1d7fe503-99fb-40fa-8491-2d50fa8d67e4` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 064 - Long Fins

- Page/scene number: 64
- Scene ID: `5c5420f6-4500-4a65-a9e6-4151ceeacea8`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Fins (slide 12, action `b2yWmwR3xH437W5ivD_IF`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `5c5420f6-4500-4a65-a9e6-4151ceeacea8`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `f5393e57-0fbe-445c-a489-b49ca4165911` (title_1):
  - Long Fins
- Text object `074b1085-2eff-4597-ad08-fb90349dd599` (content):
  - Benefits:
  - Enhanced propulsion: Long fins are designed to provide a larger surface area, which helps in transferring more power from the leg movements to the water, making each kick more efficient for propulsion.
  - Better for deep water and open ocean. They are ideal for diving in deeper water where strong thrusts and speed are necessary to navigate currents.
  - Suitability: Requires stronger leg muscles: Because of their size, they are best suited for individuals with good leg strength and conditioning.
  - May exacerbate pre-existing injuries: For those with ankle or knee problems, long fins can increase strain due to the additional resistance they create in the water.
  - Maneuverability:
  - Reduced agility: Their size can make quick changes in direction or speed more challenging.
  - Ideal for straight-line swimming: They are most effective for covering long distances in a straight line rather than for agile movements.
  - Travel:
  - Not travel-friendly: Due to their length, they can be cumbersome to pack and transport, often requiring a special bag or case.
  - Other Useful Facts: Long fins are often used by free divers and spearfishers who need the extra power to dive deep and swim against strong water currents.
  - They typically require more energy to use, which can lead to quicker fatigue if not used properly.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/b6b3efc5-3c87-4d7b-87e6-999090e7cb63.png` (source `d915b215-1d9d-4f1e-94ae-ebdec916e182`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `af589386-2618-4ab7-89ea-175ec0493dc3` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 065 - Statistics Highlighting the Need for Conservation:

- Page/scene number: 65
- Scene ID: `5da666f7-c4dd-4e98-945d-eed220535eec`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Conservation (slide 14, action `rNUHRcDO7NWWzMKxTqZZa`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `5da666f7-c4dd-4e98-945d-eed220535eec`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `5088a439-e6f6-4b80-82d0-4b162c7dd525` (title_1):
  - Statistics Highlighting the Need for Conservation:
- Text object `5c7499d2-6324-464d-9069-2e245dde31c7` (content):
  - Approximately 50% of the world's coral reefs have been lost in the last 30 years.
  - Over 33% of marine species are threatened with extinction.
  - Marine pollution has affected more than 800 species worldwide, with 80% of this pollution originating from land-based sources.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/15eb2b0f-0e1d-4bb0-9b42-19c6c375a918.png` (source `72b5c3ca-0b8d-45c4-8686-eabbe40f57c3`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4c25373e-92f1-4013-aaf4-3faab97cd606` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 066 - Waves

- Page/scene number: 66
- Scene ID: `5e52f612-7d4d-422d-8cd5-93f56f16d4af`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Enviroment (slide 15, action `vj8a0vvY0Fhl9TaspT1Fv`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `5e52f612-7d4d-422d-8cd5-93f56f16d4af`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `76560f25-3a31-44a4-8bbb-10e69a0d7b45` (title_1):
  - Waves
- Text object `beaab8a9-8bcf-4a18-b5d9-d755b7c4be53` (content):
  - Waves are disturbances that travel through the water's surface, typically caused by wind interacting with the ocean's surface. Wave size and intensity vary depending on factors such as wind speed, duration, and fetch (the distance over which the wind blows). In shallow coastal areas, waves may break near the shore, creating surf zones with turbulent water conditions. Snorkelers should exercise caution when entering or exiting the water in wave-exposed areas, as breaking waves can cause injury or disorientation.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/dff18435-41ff-4c39-a56a-f92e6486bed2.jpeg` (source `ecb0f795-a04b-4acc-bbc6-8473a02c1662`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `55b877e7-b69c-423a-bd22-7f36f0464815` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 067 - Rip Currents

- Page/scene number: 67
- Scene ID: `613938ec-2e3f-4d15-b1e7-91cc9c57d2fa`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Enviroment (slide 15, action `NLFxoOyNWUZqYl8rAV_1C`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `613938ec-2e3f-4d15-b1e7-91cc9c57d2fa`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `c80fd0c3-68a1-481e-bdb7-91173e91f5a3` (title_1):
  - Rip Currents
- Text object `9d383b00-81c0-4476-a819-91b6e5fe29e2` (content):
  - Rip currents are strong, narrow currents moving directly away from the shore. They are typically formed at breaks in sandbars or near structures such as piers and jetties. Understanding how to identify and react if caught in a rip current (swimming parallel to the shore to escape the current's grip) is vital for all water users.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/4092e999-93a9-4927-813a-fd722d6c1d70.jpeg` (source `0433217b-bcc4-4805-9a2a-7961f7cb5b9c`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `6b94aca6-edb5-4483-885a-78b183742725` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 068 - Stretch Routine - Let’s loosen up

- Page/scene number: 68
- Scene ID: `66c64710-a555-4b1c-a5e3-da58e5c592a4`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Pre Snorkel Routine (slide 21, action `qyvv2I2FEOELrRocXtqvl`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `66c64710-a555-4b1c-a5e3-da58e5c592a4`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `c0045e0a-768e-4748-b069-c11779eb27f7` (title_1):
  - Stretch Routine - Let’s loosen up
- Text object `86ecab5c-6958-486f-b39d-7df179ec80b3` (subtitle):
  - Ankles: Rotate 360°:
  - While standing or seated, extend one leg in front of you.
  - Rotate your ankle in a circular motion, making full rotations to loosen up the joint.
  - Repeat the same movement with the other ankle.
  - Calves:
  - Stand facing a wall or sturdy object, with one foot placed slightly behind the other.
  - Lean forward, keeping both heels on the ground, until you feel a stretch in the calf of the back leg. Hold the stretch for 15-30 seconds, then switch legs.
  - Hamstrings:
  - Sit on the ground with one leg extended straight in front of you and the other bent at the knee. Lean forward from your hips, reaching towards your toes on the extended leg side.
  - Hold the stretch for 15-30 seconds, then switch legs.
  - Quadriceps (Quads):
  - Stand tall and bring one heel towards your buttocks, grabbing the ankle with your hand. Gently pull your heel closer to your body until you feel a stretch in the front of your thigh. Hold the stretch for 15-30 seconds, then switch legs.
  - Hips and Groin:
  - Sit on the ground with your legs crossed.
  - Place your hands behind you for support and gently press your knees towards the ground until you feel a stretch in your hips. Hold the stretch for 15-30 seconds.
  - Sides:
  - Stand with your feet hip-width apart and arms extended overhead. Lean gently to one side, reaching towards the floor with your hand. Hold the stretch for 15-30 seconds, then switch sides.
  - Back: Cat-Cow Stretch:
  - Get on your hands and knees, with your hands under your shoulders and knees under your hips.
  - Cat Pose (Round Back): Breathe out and arch your back up like a cat.
  - Drop your head down and tuck your chin towards your chest.
  - Hold for a moment, feeling a stretch in your upper back.
  - Cow Pose (Arch Back):Breathe in and arch your back down like a cow.
  - Lift your chest up and let your belly sink down.
  - Look up slightly, feeling a stretch across your chest and belly.
  - Flowing Movement: Keep switching between Cat and Cow poses, moving with your breath.
  - Breathe out for Cat Pose and in for Cow Pose.
  - Repeat for 5-10 cycles, moving smoothly and gently.
  - Shoulders:
  - Stand tall and roll your shoulders backwards in a circular motion.
  - Repeat for 10-15 repetitions, then reverse the direction and roll them forwards.
  - Neck:
  - Sit or stand tall with your spine straight.
  - Gently tilt your head to one side, bringing your ear towards your shoulder until you feel a stretch in the side of your neck. Hold the stretch for 15-30 seconds, then switch sides.
  - **Remember to breathe deeply and slowly throughout each stretch, Visualize the coral reefs and their glory. Keep it light and never push your body into discomfort or pain. Modify each exercise as needed to suit your flexibility and mobility levels.**

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `3bcf9bc6-5ffa-48fc-87d2-d1127b3a83be` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 069 - Exposure Protectiom

- Page/scene number: 69
- Scene ID: `68177322-3f7e-4132-9bee-48f21676df58`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Pre Snorkel Routine (slide 21, action `yKBj5OYor4RR1XR1DTLW8`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `68177322-3f7e-4132-9bee-48f21676df58`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `c859476d-1ff8-47a3-9f0a-5d08df5d729f` (title_1):
  - Exposure Protectiom
- Text object `e4d688c8-783d-4764-aee8-99f3a7e8df54` (content):
  - Sun Screen: Apply a Reef safe sunscreen 30 minutes before going into the sun or water.
  - Rash Guard: Wearing a rashguard is the best bet for snorkelling, make sure the back side of your body is covered to avoid burns. Water magnifyes the suns strength, making burns appear faster, and more severe.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/96dfa627-fa69-4e28-ab4d-aca9aa5c9dbb.png` (source `c5b5b788-1c6b-455e-b8f4-f0bfc687153b`)
- image: `images/96dfa627-fa69-4e28-ab4d-aca9aa5c9dbb.png` (source `1b2e32e6-ff8c-42a1-875f-807b46a449a3`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `73107c40-f1a9-460f-b1c9-06cbf96761a2` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 070 - Surge

- Page/scene number: 70
- Scene ID: `6843f61e-d8a0-46ea-96f0-6a26e28c8554`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Enviroment (slide 15, action `AB8VIDO9ng7MMujTR4wXn`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `6843f61e-d8a0-46ea-96f0-6a26e28c8554`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `8c8cbd9d-ef46-4569-a93b-3b4e30ee6a8b` (title_1):
  - Surge
- Text object `ab164843-7626-4417-8143-b03d5150bdb1` (content):
  - Surge refers to the back-and-forth movement of water along the coastline, driven by wave action and tidal forces. Surge can vary in intensity depending on factors such as wave size, direction, and coastal topography. In sheltered areas, surge may be minimal, while in exposed coastal regions, surge can be more pronounced, especially during periods of high wave energy. Snorkelers should exercise caution when navigating surge-prone areas, as rapid water movement near rocks or reefs can pose risks of injury or entanglement.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/fb9848a1-4404-4235-b3e9-c60c07ac9643.png` (source `99519690-cf1c-42c2-9005-44408c1736f5`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `7e374dcb-da48-427d-b6b1-2e51b53f41db` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 071 - Freestyle Swimming: Speed and Streamlining

- Page/scene number: 71
- Scene ID: `6b29d187-2f5f-4582-9faf-576c3f07f42b`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Swimming Techniques (slide 30, action `q5yAORAdk-LNTRxdKLDGv`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `6b29d187-2f5f-4582-9faf-576c3f07f42b`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `b4b3cb62-b357-4f47-9e72-e5a3308509d5` (title_1):
  - Freestyle Swimming: Speed and Streamlining
- Text object `b11b3513-683e-4719-9db3-6869ef97f6e0` (subtitle):
  - Starting Position:
  - Begin by floating horizontally in the water with your face down and your arms extended in front of you. Keep your body straight and streamlined, with your legs close together and your toes pointed.
  - Arm Movement:
  - Initiate the stroke by reaching one arm forward and then pulling it down and back toward your hip in a circular motion. As one arm pulls back, the other arm should reach forward to begin the next stroke. Alternate your arm movements in a continuous, alternating fashion.
  - Leg Movement:
  - Kick your legs in a flutter kick motion, with your legs moving up and down from the hips in a quick, continuous motion. Keep your kicks small and rapid to maintain forward momentum without creating excessive drag.
  - Breathing:
  - Turn your head to the side to inhale as your arm pulls back underwater. Exhale steadily through your nose and mouth as your face returns to the water for the next stroke.
  - Timing:
  - Coordinate your arm and leg movements to work together in a smooth, rhythmic motion. Focus on maintaining a steady pace and rhythm Throughout the stroke cycle.
  - Freestyle Tips:
  - Keep your body aligned and your movements streamlined to minimize resistance and maximize efficiency.
  - Practice proper breathing technique, inhaling quickly and exhaling steadily to maintain a consistent rhythm.
  - Focus on generating power from your core and upper body while maintaining a relaxed and fluid stroke.
  - Common Mistakes:
  - Crossing your arms over the centerline of your body, which can cause your strokes to veer off course and increase resistance.
  - Kicking too forcefully or too slowly, which can disrupt your balance and rhythm.
  - Holding your breath instead of exhaling steadily while your face is in the water, which can lead

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/f9923f24-5c1b-4a2d-8815-7906c6245199.gif` (source `34debc04-7fc9-4861-b7e0-7a8d4bf7f0ee`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `9d1753e9-12e8-4d61-a5bd-976b20887624` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 072 - Reef Snorkeling:

- Page/scene number: 72
- Scene ID: `6eecdfe6-34d8-477c-a7e6-ee75dce4c901`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Types of Snorkeling (slide 31, action `mARq_OVkUIfFxH_zTUJg6`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `6eecdfe6-34d8-477c-a7e6-ee75dce4c901`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `ebfc93a4-c2a9-4daf-b4df-527d97822673` (title_1):
  - Reef Snorkeling:
- Text object `de1683e2-655e-468d-b755-7b0e244e8e01` (content):
  - Explore vibrant coral reefs teeming with marine life. These ecosystems are rich in biodiversity, offering encounters with colorful fish, sea turtles, and intricate coral formations. Look for shallow reefs close to the shore, where visibility is often excellent, and the water is calm.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/c9e94c54-0817-4e76-b1ca-5cb50d47ff58.jpeg` (source `8e83c90e-ec41-44e2-a752-720ddfaeddfa`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `25eb6a06-0440-4701-b9b3-435cd7aaabcb` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 073 - Short Fins

- Page/scene number: 73
- Scene ID: `6f618c3a-37e5-4c61-b855-ab22ea1fd048`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Fins (slide 12, action `VDdkXhLkKdcvgt8-S8C8z`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `6f618c3a-37e5-4c61-b855-ab22ea1fd048`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `705be7e0-c3a1-4877-9f79-1fdb42d50e1c` (title_1):
  - Short Fins
- Text object `b6444442-3851-4311-aec2-71aaa33b968d` (content):
  - Benefits:
  - Greater comfort: Short fins are lighter and cause less strain on the legs, making them more comfortable, especially for longer snorkeling sessions.
  - Better for shallow water: Their size makes them more appropriate for snorkeling in shallow waters where long fins could hit the seabed and damage the marine environment.
  - Suitability:
  - Ideal for beginners: The reduced size and lighter weight make them a great option for beginners or those with less leg strength.
  - Safer for those with injuries: They offer less resistance in the water, making them a safer choice for snorkelers with knee or ankle injuries.
  - Maneuverability:
  - Increased agility: Short fins allow for quicker and more precise movements in the water.
  - Useful for underwater photography: They make it easier to maintain a stable position when taking photos or observing marine life.
  - Travel:
  - Travel-friendly: Their compact size makes them easy to pack and carry, fitting into most standard luggage.
  - Other Useful Facts:
  - - Short fins are popular among recreational snorkelers and swimmers for pool training.
  - - They help to improve leg strength and technique due to the higher frequency of kicks needed to maintain speed.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/d8061d4c-721e-418b-bae0-3bbb8572c22d.png` (source `3b7ec740-b306-43a7-aca8-b5595b768e3a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `e630a98c-c40a-4c7f-8eb2-375aefd9b051` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 074 - One Hand Tilt

- Page/scene number: 74
- Scene ID: `76f423b6-af0a-4dca-a5bd-19ee238566d4`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Mask Clearing (slide 25, action `mtB5fVoPN1nAHgT3TwE35`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `76f423b6-af0a-4dca-a5bd-19ee238566d4`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `96643a12-7ff9-4517-9b0b-bdee0e8eb851` (title_1):
  - One Hand Tilt
- Text object `823864db-b006-4019-bdcd-822abb581cb9` (content):
  - Place index finger on top frame, use thumb to pull bottom seal away.
  - Take a nice big breath in through your mouth
  - Continuously breath out of your nose whilst lifting your chin up and looking towards the sky
  - And there you go, should be clear of water: if there is still some water just repeat steps 2 & 3.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `76c906a0-c343-4c7c-bac9-9555aea6bf68` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 075 - Meaning: Reccomened simming area, with life guard supervision.

- Page/scene number: 75
- Scene ID: `772bbad3-537a-4fa7-a9a1-9d7f22537916`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `fsm4xEtMiGXsVTJtxroB9`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `772bbad3-537a-4fa7-a9a1-9d7f22537916`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `0896371c-0669-4259-af7d-e28094f81862` (text):
  - Meaning: Reccomened simming area, with life guard supervision.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `5b40dd6b-e0b8-4ac1-9921-a287b1220ef2` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 076 - Marine mammals

- Page/scene number: 76
- Scene ID: `7912be09-1c55-49c2-93f8-69565a8e7f09`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Aquatic Life (slide 16, action `qxbx3YDTeo99zSExxJ3eW`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `7912be09-1c55-49c2-93f8-69565a8e7f09`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `1cc82767-51da-4582-9135-61a41129aa81` (title_1):
  - Marine mammals
- Text object `b6504a81-3eef-4ba6-a80d-c5050ef20db8` (content):
  - Including dolphins, whales, and seals, are warm-blooded animals that have adapted to life in the ocean. Look for signs of marine mammals such as dorsal fins, flippers, and spouts of water as they come up to breathe. Keep a respectful distance and observe their behavior from afar to avoid causing disturbance.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/3bc365b1-ea6f-4b09-8f41-4db19d6e494a.jpeg` (source `435fc056-5b4a-4c5b-b96a-63487e07a3a2`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `29f07431-964d-4aba-b4c8-454e4841b75b` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 077 - Meaning: Offshore winds present, inflatables should not be used.

- Page/scene number: 77
- Scene ID: `8244fe2f-6fbe-438c-9718-90cbb7fd4b37`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `j0PP0wfH5DYKv1naBPRpr`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `8244fe2f-6fbe-438c-9718-90cbb7fd4b37`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `91c67ee1-1dbc-4d4e-8dd4-744cebd8a32b` (text):
  - Meaning: Offshore winds present, inflatables should not be used.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `e0227d18-ee0e-461c-8f1e-08f45aae1133` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 078 - Closed Heel FIns

- Page/scene number: 78
- Scene ID: `83c421e7-84be-4ed9-ad68-6c6f74076e03`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Fins (slide 12, action `hRUhojb6WFpkKd2N5z4TU`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `83c421e7-84be-4ed9-ad68-6c6f74076e03`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `0289a967-4f8a-4c05-8efb-582123b01233` (title_1):
  - Closed Heel FIns
- Text object `c511f6ef-b4a5-48b0-a28d-6879b1017cdb` (content):
  - Suitability:Ideal for warm-water snorkeling, as they do not require additional boots. Lightweight and compact for easy travel.
  - Drawbacks:
  - Can't wear boots, which leaves your feet exposed to the elements (not ideal for cold water)

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/edd6667b-1161-43ba-bddb-bb9f9b565e41.png` (source `53992920-51b4-411d-b40e-9f4f0fb011f4`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4e74a1a2-0172-49f5-a171-cfac0d0c68bd` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 079 - Treat minor cuts and bruises with antiseptic wipes and adhesive bandages.

- Page/scene number: 79
- Scene ID: `89d83254-5d00-4e02-953f-f28b7cfea566`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: First Aid Essentials for Snorkeling (slide 32, action `qQK5y9o1tfzNYieNaVnqm`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `89d83254-5d00-4e02-953f-f28b7cfea566`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `d21471c7-6d66-4da2-9518-fda6efb2d619` (subtitle):
  - Treat minor cuts and bruises with antiseptic wipes and adhesive bandages.
  - Administer pain relievers for minor aches and pains.
  - Carry a first aid kit with essential supplies, including gauze, adhesive tape, scissors, and gloves.
  - Always seek medical attention for serious injuries or medical emergencies.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `722d6be9-561f-4a2a-8501-e4aa9f3475e3` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 080 - What is Coral?

- Page/scene number: 80
- Scene ID: `8bbd184f-a24a-4876-af3e-bafc70f0563e`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Aquatic Life (slide 16, action `1QrRVdK3Uk_uED2mPzAjW`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `8bbd184f-a24a-4876-af3e-bafc70f0563e`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `88924daf-1944-4535-b6ac-ffcab24875bd` (title_1):
  - What is Coral?
- Text object `ef6db2b9-e08a-471a-80f3-a5638dfd17b5` (subtitle):
  - Corals are the architects of some of the most vibrant and diverse ecosystems on our planet, and understanding their importance is crucial for snorkelers. Here's a glimpse into the fascinating world of corals:
  - Corals have a unique relationship with tiny algae called zooxanthellae. These algae live inside the coral's tissues and provide them with essential nutrients through photosynthesis. In return, the corals offer the algae a safe haven and access to sunlight. This symbiotic relationship is the cornerstone of coral reef ecosystems, fueling their productivity and diversity.
  - Corals are incredibly slow-growing organisms, with some species adding just a few millimeters to their skeletons each year. However, given enough time, they can form massive colonies that provide habitat for a myriad of marine life. Coral reproduction occurs through spawning events, where corals release eggs and sperm into the water simultaneously, resulting in the fertilization and settlement of new coral larvae.
- Text object `b84a3aa9-8941-46ec-9e0e-f968575df223` (title_1):
  - Hard vs Soft Coral
- Text object `c1e98d6d-1765-42e2-8e71-95e3bcf80e65` (subtitle):
  - There are two main types of corals: hard corals (also known as reef-building corals) and soft corals. Hard corals form the backbone of coral reefs, secreting calcium carbonate skeletons that accumulate over time and create massive underwater structures. Soft corals, on the other hand, lack a hard skeleton and instead have flexible, fleshy bodies adorned with polyps.
- Text object `90ded884-a8c8-403c-b6f9-c96bd4b169dd` (title_1):
  - Facinating Coral Facts
- Text object `f9daa57b-211e-4476-ad2b-1867d50ea16e` (subtitle):
  - Coral reefs are often referred to as the "rainforests of the sea" due to their incredible biodiversity.
  - Some corals can live for hundreds to thousands of years, making them among the oldest living organisms on Earth.
  - Coral reefs cover less than 1% of the ocean floor but support an estimated 25% of all marine species.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/8c722756-5afe-404e-abe9-b786bb901078.jpeg` (source `f00cfdd7-b93a-4a67-b2e8-2db85f2be155`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `50f2a53f-b66a-49f8-bef2-f55cab01c1f1` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 081 - Sand Snorkelling

- Page/scene number: 81
- Scene ID: `9213c0f5-93d2-4384-9717-fcc5d19070ef`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Types of Snorkeling (slide 31, action `rrxUBGBlFX9YebQQvXsEh`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `9213c0f5-93d2-4384-9717-fcc5d19070ef`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `bc7ada42-2970-4fad-9880-7f7b1d56a469` (title_1):
  - Sand Snorkelling
- Text object `351fbaaf-e6b9-4c64-9f1f-d4dbfade1997` (content):
  - Dive into sandy seabeds where hidden treasures await. While not as visually stunning as reefs or wrecks, sand snorkeling offers opportunities to spot unique creatures like stingrays, flounders, and camouflaged critters. Look for areas with seagrass beds or sandy patches near coral reefs where marine life congregates.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/c5a36a3e-d496-449f-9ebd-7c374758f12d.jpeg` (source `5dc03f18-84fb-4b03-9fdd-785d4e6cf4ca`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `3483411d-242b-4fe2-9488-d7131fba1865` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 082 - Dual Lens

- Page/scene number: 82
- Scene ID: `94d68d83-c79d-4679-afd2-1aa15f88d6e6`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `nYtHdenMb4yRgHspGXz2s`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `94d68d83-c79d-4679-afd2-1aa15f88d6e6`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `905b11a4-5012-4937-a8fd-d1ac66a9ee26` (title_1):
  - Dual Lens
- Text object `23dc50e0-2f0b-4810-a3c2-52d3b915cf30` (content):
  - Ideal for prescription masks, offering better optical clarity and vision correction compared to single-lens masks. Twin lenses provide a wider field of view and minimize distortion, enhancing the overall snorkeling experience.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/7121574a-ce55-44ff-aff2-315910f5c49b.png` (source `ecc78c76-e263-4d16-915b-cf528a31f66e`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `72b4fdfe-aafe-44d5-8185-a0a9a64ff504` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 083 - To safeguard marine life and promote a sustainable future, Ocean Optics encourages the following practices during any underwater activity:

- Page/scene number: 83
- Scene ID: `97ea441f-0551-444e-872e-6f05f24c5d39`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Conservation (slide 14, action `kbymltqmlfNxRhkZk3Zj1`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `97ea441f-0551-444e-872e-6f05f24c5d39`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `019d16a6-e63b-429b-a418-067a4a806b4b` (title_1):
  - To safeguard marine life and promote a sustainable future, Ocean Optics encourages the following practices during any underwater activity:
- Text object `30f8e0ce-40c2-4d74-8dd1-8d57a1041e35` (content):
  - Avoid Touching Coral: Corals are living organisms. Even a slight touch can transmit harmful bacteria or cause physical damage that takes years to heal.
  - Do Not Stand on Coral: Coral structures are fragile. Standing on them can cause irreparable damage and disrupt the habitat of many marine species.
  - Be Mindful of Your Hands and Fins: Avoid making contact with any marine life or habitats. Maintain buoyancy control to prevent accidental harm.
  - Know Your Limits: Engage in activities that match your skill level. Overestimating your abilities can lead to dangerous situations for you and the environment.
  - Respect Marine Wildlife: Observe from a distance and avoid chasing, touching, or feeding the wildlife. Interactions should be on the animals' terms without causing stress or alterations in their natural behaviors.
  - Participate in Clean-up Efforts: Whenever possible, join beach or underwater clean-ups to remove debris that threatens marine ecosystems.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b2e34f4e-9eb6-443d-b01f-5a8b5d09420e` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 084 - Rescue Breaths:

- Page/scene number: 84
- Scene ID: `9996eeeb-a46b-4f77-9b10-f4fb82f5769d`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: First Aid Essentials for Snorkeling (slide 32, action `OTdMqdLjSBmrBPRqsbpz8`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `9996eeeb-a46b-4f77-9b10-f4fb82f5769d`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `842c5c41-2d10-4a94-b60a-c21a46d65ec8` (title_1):
  - Rescue Breaths:
- Text object `aab17337-4ef3-4809-8717-452c083e2ecb` (content):
  - Pinch the victim's nose shut and cover their mouth with yours.
  - Give two breaths, each lasting about one second and making the chest rise.
  - Continue CPR: Perform cycles of 30 compressions and 2 breaths until help arrives or the victim shows signs of life.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4354018e-3b98-485f-9f78-a8e843bcc6cf` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 085 - Shallow Water Blackouts

- Page/scene number: 85
- Scene ID: `9b21d3d9-93c7-4304-8d0f-acd7cd4d2f4d`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physiology (slide 18, action `IuUezKn3puS1OPxYvCmoI`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `9b21d3d9-93c7-4304-8d0f-acd7cd4d2f4d`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `c2c92942-3ce6-4a65-8a43-07b6cb044ed0` (title_1):
  - Shallow Water Blackouts
- Text object `8e39e7e9-8c21-4842-8b2f-b54f2b58533c` (content):
  - Shallow water blackouts occur when a snorkeler hyperventilates before a dive, reducing the CO2 levels in their bloodstream. This can delay the urge to breathe, leading to unconsciousness underwater due to lack of oxygen. Shallow water blackouts are particularly dangerous because they can occur suddenly and without warning.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/56680d10-3d32-4d95-a24e-d0e2a45e67b0.png` (source `844dffba-7434-4b08-847a-9aad9d1c6d9a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `5726be3c-9983-4d6a-9581-aec0ae3276e1` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 086 - Meaning: Watercraft area.

- Page/scene number: 86
- Scene ID: `9cda9d97-1723-4d22-bd05-248f5d8d6133`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `LD750R4jT4agRE5nRJeyl`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `9cda9d97-1723-4d22-bd05-248f5d8d6133`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `d105e237-82ba-4948-9da3-bf06768b5529` (text):
  - Meaning: Watercraft area.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `25dc7286-5cab-43eb-b145-38f3cdb3753b` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 087 - Breath Control and Movement: Enhancing Your Snorkeling Performance

- Page/scene number: 87
- Scene ID: `9e4ba789-3efe-4494-8bb2-4e092fec6bab`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Swimming Techniques (slide 30, action `kp2SSz_gn0M92xEIyQ8D5`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `9e4ba789-3efe-4494-8bb2-4e092fec6bab`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `86af12d2-ba69-42c4-9e51-ad7e0e17eb69` (title_1):
  - Breath Control and Movement: Enhancing Your Snorkeling Performance
- Text object `2ce71b67-c577-4f71-9e36-05f2f58374c0` (content):
  - Mastering your breathing is essential for snorkeling success. Practice slow, steady breathing techniques to conserve energy and maintain relaxation underwater. Focus on inhaling deeply through your snorkel and exhaling slowly to maintain a steady rhythm throughout your dive.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/177e67b2-f386-49c6-9f1e-9b77aa9b0430.gif` (source `9f11f935-bec6-4661-af8c-f11872425d81`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `235cdf14-a84c-4e3a-8afb-63007a983ae1` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 088 - Chest Compressions:

- Page/scene number: 88
- Scene ID: `a24684be-aa01-4fde-82d0-63125a1b9638`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: First Aid Essentials for Snorkeling (slide 32, action `xD3XtW_WwlAOdZqEOEps6`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a24684be-aa01-4fde-82d0-63125a1b9638`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `f9756a87-9dc9-4f72-8241-4aab40e90e45` (title_1):
  - Chest Compressions:
- Text object `043eb46e-1e4e-4de1-b51f-4f041679a611` (content):
  - Place the heel of one hand on the center of the victim's chest (between the nipples).
  - Place the other hand on top and interlock fingers.
  - Position yourself directly over the victim's chest, elbows straight.
  - Push hard and fast, at least 100 compressions per minute, allowing the chest to recoil completely between compressions.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `26e5b718-280b-4339-bcd2-ebf3d4f024ec` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 089 - Pro Equalisation Tips

- Page/scene number: 89
- Scene ID: `a4b9e79b-c327-47ad-8b4f-28e2870b4aef`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Equalizing and Decent (slide 19, action `yzemKjUwJs7nEG7bYN-ZW`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a4b9e79b-c327-47ad-8b4f-28e2870b4aef`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `29507aa4-d503-4ae4-b96a-9ff35ed6cbed` (title_1):
  - Pro Equalisation Tips
- Text object `72ca1fda-73ce-4cf6-874c-7238abf38b63` (content):
  - Avoid forcing equalization, as this can lead to injury or discomfort.
  - You should feel a slight relief in both ears after equalizing.
  - If you experience difficulty equalizing, ascend slightly and try again.
  - Clearing your nose before descending can help free up nasal passages and facilitate equalization.
  - By mastering these equalizing techniques and understanding the principles behind them, divers can enjoy safe and comfortable descents into the underwater world, free from the discomfort of barotrauma.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4f8a26fa-213b-4e89-93db-16b192eea1e8` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 090 - Signaling Buoy

- Page/scene number: 90
- Scene ID: `a51147b7-11be-4dc9-9f26-104330b2002e`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Safety Devices (slide 11, action `6mu1QOEnvnzvs-a3jirmD`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a51147b7-11be-4dc9-9f26-104330b2002e`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `76e5f868-1112-49c9-8d77-8ba217036f50` (content):
  - A visual Aid to make sure you are seen by both boats and other snorkelers.
  - Enhance safety and security during underwater exploration.
  - Acts as a floatation device
- Text object `11987175-badc-4b2d-a01c-ea08da1ad8ea` (title_1):
  - Signaling Buoy

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `71db3472-e510-40e4-a037-778c485d2e05` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 091 - Fun Fishy Facts

- Page/scene number: 91
- Scene ID: `a514a0ac-64e1-4eab-a932-ebe1ba32a0c6`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Aquatic Life (slide 16, action `1XN3IvrGH-OwZBeX990Mc`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a514a0ac-64e1-4eab-a932-ebe1ba32a0c6`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `b68ed102-7d81-463b-9da2-4106c7fb3a20` (title_1):
  - Fun Fishy Facts
- Text object `06c20552-cc7a-4ab8-a472-34454dd7a257` (subtitle):
  - Some bony fish, like the clownfish, form symbiotic relationships with anemones, using them for protection from predators
  - Cartilaginous fish, such as manta rays, are filter feeders, using their modified gill rakers to strain plankton from the water.
  - Marine mammals, like humpback whales, are known for their elaborate courtship displays, including breaching, tail slapping, and singing complex songs.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/906951b0-4861-4811-be13-f12e519e452c.png` (source `04e868cb-eaf0-4c2a-b7a6-06025d9f035a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `66e6a50e-4dd8-46bc-8645-562fd723c554` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 092 - Tides

- Page/scene number: 92
- Scene ID: `a6528720-a8c4-4a23-81a9-72cdbbf34e60`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Enviroment (slide 15, action `luq5aBLtaLDXhEhqSmVTX`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a6528720-a8c4-4a23-81a9-72cdbbf34e60`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `7279e45b-5748-466a-aed5-4fec623b56d2` (title_1):
  - Tides
- Text object `9a49d4c0-c109-4cf9-a053-3f87b791e541` (content):
  - Tides are the periodic rise and fall of sea levels, resulting from the gravitational forces exerted by the moon and sun. The gravitational pull of the moon causes two high tides and two low tides each day, while the sun's gravitational influence contributes to variations in tidal height throughout the lunar month. Understanding tidal patterns is essential for planning snorkeling activities, as tidal fluctuations can affect water depth, current strength, and visibility. Snorkelers should be aware of tidal predictions and plan their outings accordingly, taking into account factors such as tidal range and timing.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/31b20c10-3474-4db6-8c07-3a54329572a2.gif` (source `c9b1a6d6-e896-4d2f-8415-146095f6f334`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b5acffe2-4171-496a-90b9-2c872952468b` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 093 - Hypocapnia

- Page/scene number: 93
- Scene ID: `a65b9fbc-51b4-492d-b066-f2f548708678`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physiology (slide 18, action `1Y2Hdt8rEno-ORfJDIdEE`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a65b9fbc-51b4-492d-b066-f2f548708678`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `bf4ef710-cad4-4b85-b1aa-753c6c39c6d8` (content):
  - Conversely, hypocapnia occurs when there's a reduced level of CO2 in the bloodstream, often resulting from over-breathing or hyperventilating. This can lead to respiratory alkalosis, causing symptoms such as tingling sensations, muscle cramps, and fainting.
  - .
- Text object `3273a04c-3b54-4871-93a1-ac76efe606f2` (title_1):
  - Hypocapnia

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/8decbb0d-9592-414b-b861-57bedb6d756f.png` (source `ab2c37f7-c1b5-4ccc-bcf3-4d5927767111`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `32f7e47c-f762-4b0a-b5e4-4a0e3569c5a7` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 094 - Airspaces

- Page/scene number: 94
- Scene ID: `a67d4640-097c-4b83-a660-8d6ce786167c`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physics (slide 17, action `enFR0b324PU6jbPm-76Zw`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a67d4640-097c-4b83-a660-8d6ce786167c`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `9a1e90e2-3379-4b1c-90c3-2b3a3c62f5cb` (title_1):
  - Airspaces
- Text object `d3f6a6a7-a74e-4fad-b829-40640f796c4d` (content):
  - As we descend underwater, pressure increases due to the weight of the water above us. Boyle's law states that as pressure increases, the volume of gas decreases. This principle is crucial for divers because it affects air spaces in our bodies, such as the sinuses, middle ear, and lungs. To prevent discomfort and potential injury, divers must equalize the pressure in these air spaces.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/a6b5f178-be81-43fe-ac9c-ba70113f1ce9.jpeg` (source `9fdecda9-0289-4503-8b0c-ac27bf046a12`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `48a274e1-1b58-4d25-aae3-08724dd219e1` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 095 - Drowning:

- Page/scene number: 95
- Scene ID: `a92e90cd-1c3d-4563-9ea3-b959e6e30e52`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: First Aid Essentials for Snorkeling (slide 32, action `88vC0pYYZkQd4Tpyjwp5W`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `a92e90cd-1c3d-4563-9ea3-b959e6e30e52`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `e7d078a4-0def-4f49-93fb-00fc55e07150` (title_1):
  - Drowning:
- Text object `0efdf5f5-5829-464f-b9e7-cd1689b614e3` (content):
  - Remove the victim from the water immediately.
  - Check for responsiveness and breathing. If unresponsive, start CPR.
  - Monitor for signs of shock and seek medical attention.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `f87f4911-53aa-4209-9420-a2a0e416ac5d` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 096 - Frog Kick

- Page/scene number: 96
- Scene ID: `aa6fdcd7-5059-4670-b3fd-454e7269ed39`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Kicking Styles (slide 24, action `8lk_B0J1ai2mJWH0VEcH9`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `aa6fdcd7-5059-4670-b3fd-454e7269ed39`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `cc3ba15d-e8e4-4a4a-81a8-bb2a3009617f` (title_2):
  - Frog Kick
- Text object `de15f034-5a83-4947-a4aa-15f70945b21f` (title_1):
  - The frog kick is a technique favored by many snorkelers for its gentle, efficient propulsion and the ease with which it allows you to maneuver. Here’s how to perform the frog kick while snorkeling:
  - Body Position: Float face-down in the water with your body in a straight line from head to heels.
  - Leg Position: Start with your legs together and your knees bent at a 90-degree angle, heels near your buttocks.
  - Kick Motion: Move your legs outward in a V-shape and then push them back together, propelling you forward. The motion is similar to how a frog's legs work when it swims, hence the name.
  - Fin Tip: When using fins, make sure to utilize their flexibility. Imagine your fins as extensions of your body, working in harmony with the leg motion to enhance your propulsion.
  - Ankle Use: During the kick, it's crucial to articulate your ankles – pointing your toes outwards as your legs open and then flexing them as you bring your legs together. This action maximizes the surface area pushed against the water, increasing efficiency.
  - Controlled Pace: The frog kick is not about speed but control and stability, making it ideal for navigating around delicate coral or observing marine life without disturbing the environment.
  - This kick is not only energy-efficient but also reduces the amount of sand or silt kicked up, which is especially beneficial in preserving underwater visibility and minimizing impact on marine habitats. Practice this kick in calm waters to get a feel for the motion before applying it on your snorkeling adventures.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/974096ef-4040-480b-9f4c-f27fbb798ab9.gif` (source `945d6392-38be-4a31-8a92-66ba5b7a5543`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `3da8e9d0-3ea5-4f76-a0a6-4a231e99da0f` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 097 - Ways to Help the Environment

- Page/scene number: 97
- Scene ID: `aaf0dccc-dc5b-4f35-88fc-e7a31e67586e`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Conservation (slide 14, action `S19KntlOwFUIJLcn2pKcR`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `aaf0dccc-dc5b-4f35-88fc-e7a31e67586e`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `6ec8fbcd-6b03-4255-92ab-5a64b0138482` (title_1):
  - Ways to Help the Environment
- Text object `6dee44ff-ef46-4f7f-9680-bfbfce7521e9` (content):
  - Reduce plastic use to decrease marine pollution.
  - Support sustainable seafood choices to lessen overfishing impacts.
  - Participate in or donate to marine conservation projects and organizations.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/e975ec00-0f38-4dae-9fcc-0aa432f2cb61.png` (source `7458ddec-d3e2-45a0-b7ea-f78362cad04b`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `e91467c9-6c26-4bdc-88b6-cfbb1f90aff6` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 098 - Snorkel Clearing

- Page/scene number: 98
- Scene ID: `acd0c101-da7b-4d15-ac0a-387c620939de`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Snorkels & Duck Diving (slide 23, action `8pg8OU_nL_WQnPkkq_obm`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `acd0c101-da7b-4d15-ac0a-387c620939de`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `e01bd1e8-0ed4-4255-8739-f539aa505ad1` (title_2):
  - Snorkel Clearing
- Text object `cd2b205f-c16c-474f-8326-db0d31bd9fa7` (title_1):
  - One of the essential skills in snorkeling is clearing your snorkel if water gets in. Remember, all you need to do is spit it out hard. We call this the blast method. Modern snorkels come with a purge valve. This means the water is expelled from the bottom requiring less effort and force so you can breathe easily and enjoy your dive without interruptions.
  - Blast method - When water enters the snorkel exhale forcefully through your mouth to clear water.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `801f1ff3-46cc-4aca-8582-41e328474bce` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 099 - Whistle

- Page/scene number: 99
- Scene ID: `aeda8274-0c48-44b8-b033-33705e98b1ac`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Safety Devices (slide 11, action `EPymCUp-Ue8HxMvE15gDh`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `aeda8274-0c48-44b8-b033-33705e98b1ac`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `7c5535a2-0a58-431b-949e-c80245d02afa` (title_1):
  - Whistle
- Text object `d2fbaf20-869d-4944-ae5f-2f9935ff1e16` (content):
  - Small and lightweight whistles are essential for attracting attention and signaling for help in emergency situations.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `4106e254-b948-48b0-8304-fbd8e9417c81` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 100 - Two Hand Method

- Page/scene number: 100
- Scene ID: `af3abd10-6ca1-4912-a2b1-78c4df95bccf`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Mask Clearing (slide 25, action `DDuny5ORYETLC0_gQcCp8`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `af3abd10-6ca1-4912-a2b1-78c4df95bccf`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `4d9bcd0f-235f-47d6-9d28-b8b6fee3cf19` (title_1):
  - Two Hand Method
- Text object `18f74ddf-8cd1-4fe6-a2e6-78ba92064139` (content):
  - Place middle and index fingers on the top frame.
  - Take a nice big breath in through your mouth
  - Continuously breath out of your nose whilst lifting your chin up and looking towards the sky
  - And there you go, should be clear of water: if there is still some water just repeat steps 2 & 3.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/ba97f06c-2176-4783-8c8e-fa1456a23571.gif` (source `e9528d1f-51ea-4fbc-9328-b6b9ec884b28`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `667f91d0-03f3-4585-9214-a3d96773ce8f` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 101 - Meaning: high hazard.

- Page/scene number: 101
- Scene ID: `b546f9b6-49df-46d6-a02e-42cd03c0a811`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `jR57AD-qpYGtZB8cNJ_LX`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `b546f9b6-49df-46d6-a02e-42cd03c0a811`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `6fbc3bdc-4e99-4d6e-aa27-f4079b732e78` (text):
  - Meaning: high hazard.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `3ba31f54-2cd3-4625-94a4-4d24f0c3ec0d` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 102 - Artificial Reef Snorkeling:

- Page/scene number: 102
- Scene ID: `b590d7ad-3cc3-472f-9ddc-0d1678d4ada6`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Types of Snorkeling (slide 31, action `mCWeqEBFmsU8ygcayypuc`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `b590d7ad-3cc3-472f-9ddc-0d1678d4ada6`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `89ff2019-6b61-4640-9b37-49f201e67884` (subtitle):
  - Artificial Reef Snorkeling:
  - Explore man-made structures like submerged sculptures, artificial reefs, or underwater gardens. These sites provide habitat for marine life and serve as conservation and tourism initiatives. Artificial reefs often attract a diverse array of fish and offer opportunities for underwater photography and environmental education.
  - Final words to share

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/9481591c-f60b-4b05-a41b-9a913ccdacbb.png` (source `92e7e39b-9b9f-4328-b402-1808aa7bce7d`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `04935725-784b-44d8-8bf6-17cf9ee63c36` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 103 - Mono Lens

- Page/scene number: 103
- Scene ID: `bef7c8fb-0185-441b-aba8-92e3d1d559e0`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `Wa6z_dV3_sAOixMfr2XnZ`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `bef7c8fb-0185-441b-aba8-92e3d1d559e0`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `e30e199f-8cbc-4967-b13f-ada3de339923` (title_1):
  - Mono Lens
- Text object `7f168c83-77c3-424e-ac43-897171f380c7` (content):
  - A mono lens scuba mask appeals to those with normal vision due to its simplicity, affordability, and ease of sharing in group dives. However, it lacks customization options for prescription lenses, making it less suitable for individuals requiring vision correction underwater

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/017880cc-9ac6-4ae2-a924-7251d93bb548.png` (source `ac62072a-42f0-4b43-953a-e6e6dbbde48f`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `18df9875-9e36-4129-909f-67e65f7df126` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 104 - Meaning: Medium hazard.

- Page/scene number: 104
- Scene ID: `c27bad6c-b91f-496e-a6d8-bd55c372e622`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Beach Flags (slide 27, action `lMHdst1UX_5qsHiiaGYb3`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `c27bad6c-b91f-496e-a6d8-bd55c372e622`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `5a6f22fe-1e8c-4c11-ba1f-47fb3b00d827` (text):
  - Meaning: Medium hazard.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `8f0700bf-5d91-48a9-8313-f95a722f139c` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 105 - Open Heal Fins

- Page/scene number: 105
- Scene ID: `c2d96665-e9d9-4132-a4f0-c4349226d198`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Fins (slide 12, action `VfTV35HF0ZPzswzITpzXQ`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `c2d96665-e9d9-4132-a4f0-c4349226d198`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `34924c45-4b8f-4026-b8ef-fae0445858a0` (title_1):
  - Open Heal Fins
- Text object `5fad3176-aeeb-4ddd-8eb0-bcb3dd197e88` (content):
  - Benefits:
  - Offer greater flexibility and adjustability for various conditions and diving styles.
  - Drawbacks:
  - May require additional footwear like dive boots for a secure fit and protection against abrasions.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/a05b9cc7-b321-4e3e-b6cb-8fa299a5c012.png` (source `4599a948-c379-4e6c-b7dc-b2e1e23bde56`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `aceb1cb9-ab30-4ecf-afff-d95d79ddba91` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 106 - Wetsuit

- Page/scene number: 106
- Scene ID: `c2de140f-be2d-4c97-a65a-bdf345703e6d`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Equipment Zone (slide 8, action `U7aR3jQuBGGd0V8zFu2PM`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `c2de140f-be2d-4c97-a65a-bdf345703e6d`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `995584cf-0d3b-4bac-b003-da02759aa860` (content):
  - Thermal protection in water sports is crucial for maintaining body heat, preventing hypothermia, and enhancing comfort during underwater activities. Wetsuits are the most common form of thermal protection, designed to preserve body warmth in cooler water temperatures.
  - How Neoprene Works:
  - Neoprene, the primary material in wetsuits, is a type of synthetic rubber filled with tiny gas bubbles.
  - When submerged, neoprene traps a thin layer of water between the suit and the skin. Your body heats this water, which serves as an insulating layer, retaining warmth.
  - The thickness of neoprene varies (measured in millimeters) and is chosen based on water temperature. Thicker suits offer more warmth but can reduce flexibility.
- Text object `e9afb436-0f20-497a-ad17-ab68ea8cd2b6` (title_1):
  - Wetsuit
- Text object `0b2b7a32-d0e9-480a-98e1-f97c3470868c` (content):
  - 5
  - Ensuring a Proper Wetsuit Fit:
  - Measurement: Accurate body measurements are crucial. A well-fitting wetsuit should adhere snugly to your body without restricting movement. Key measurement areas include the chest, waist, hips, and length of arms and legs.
  - Additional Tips:
  - After use, rinse your wetsuit with fresh water and hang it to dry in the shade. Avoid direct sunlight and heat sources, which can degrade the neoprene.
  - Periodically check for and repair any tears or separations to prolong the life of your wetsuit.
  - Consider the water activities you'll be engaging in when selecting wetsuit style and thickness, balancing the need for warmth against the requirement for flexibility.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/5dcd3b4a-3e4e-46db-a16c-db1fbc77ed0d.png` (source `ae7dcf3d-3140-4be3-8ef2-917a314383f7`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `8827ceeb-6c6c-43c9-9aed-146ff5a438cb` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 107 - Duck Diving

- Page/scene number: 107
- Scene ID: `c7e00449-6346-4dc9-9733-f32e09fe98ae`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Snorkels & Duck Diving (slide 23, action `p67S4B28BtxatZyx6UX3J`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `c7e00449-6346-4dc9-9733-f32e09fe98ae`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `dde7450f-949d-4377-b239-2e86245f23bd` (title_1):
  - If you're ready to explore deeper underwater, duck diving is the way to go. It allows you to descend below the surface and get a closer look at the underwater world around you. Remember buddy teams should alternate rolls. One remains looking out on the surface, whilst the other descends.
  - Steps: Lay face down with mask and snorkel in.
  - Bend at the hips, kick legs up to submerge.
  - Hold your breath: Minimize movement and extend your breathhold!
  - while ascending, remove snorkel, protect your head.
  - Once on the surface, ensure the snorkel is clear and place it back in your mouth.
  - Clearing Snorkel from Duck Dive: When performing a duck dive, it's crucial to remove your snorkel from your mouth to stop any water from entering your mouth.
  - Resurfacing: When you reach the surface you can simply keep your head out of the water and take nice deep breaths until you are ready to put the snorkel back in.
- Text object `ec9c76c8-8227-40ee-a4b7-c162bd4e1983` (title_2):
  - Duck Diving

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `6afb748d-70b5-4c14-9a41-ff83b1c53897` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 108 - Flutter Kick

- Page/scene number: 108
- Scene ID: `c8c53c1c-ffb2-40b7-b094-68cdc1aa8f4b`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Kicking Styles (slide 24, action `xCjNib3lj2mmstS-3Gf8_`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `c8c53c1c-ffb2-40b7-b094-68cdc1aa8f4b`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `5d39113e-35cb-4029-a452-c2a94c67969b` (title_2):
  - Flutter Kick
- Text object `0fba30df-92ae-4f64-bcb3-7724e17a969f` (title_1):
  - The flutter kick is a basic but essential snorkeling technique that propels you through the water with minimal effort and optimal efficiency. Here's how to execute a proper flutter kick:
  - Body Alignment: Start by floating face-down in the water, keeping your body as flat and streamlined as possible.
  - Leg Position: Your legs should be extended straight behind you, with a slight, natural bend in the knees. They should not be rigidly straight or bent too much.
  - Kick Motion: The movement originates from the hips, with a slight involvement of the thighs. Let your lower legs and feet follow in a fluid, whip-like motion.
  - Alternate the Legs: The kicks should be alternating, with one leg rising as the other descends in a steady, rhythmic pattern. Think of a dolphin's tail movement as a good analogy.
  - Amplitude of the Kick: Keep the kicks relatively shallow. The movement should be large enough to generate forward momentum but small enough to maintain energy efficiency.
  - Foot Position: Point your toes to straighten the feet, reducing drag and maximizing the kick's push.
  - Breathing Pattern: Maintain relaxed breathing through your snorkel, keeping your face in the water. Synchronize your breathing with your kicks for better rhythm and energy conservation.
  - Practice the flutter kick in a controlled environment, like a swimming pool, to refine your technique before taking it into open water. It's a versatile kick that serves well for both casual snorkeling and more vigorous swimming.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/495b2015-823e-4c8f-b62c-d267975c8202.gif` (source `f99da3a2-af1e-42a9-9054-cc711ecd5733`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `17c6c854-d0c5-4f16-a778-00ee6cd58dcf` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 109 - Jellyfish Stings:

- Page/scene number: 109
- Scene ID: `caf92656-9305-4997-938f-1aa0c4496ee7`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: First Aid Essentials for Snorkeling (slide 32, action `K_LYa6J0GR4KhCnav55kP`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `caf92656-9305-4997-938f-1aa0c4496ee7`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `af7a8db5-abb4-4c87-b90e-2be2a0f948fb` (subtitle):
  - Jellyfish Stings:
  - Rinse the affected area with vinegar to neutralize the venom.
  - Remove tentacles with tweezers or a gloved hand (do not touch with bare hands).
  - Soak the area in hot water (not scalding) for 20-45 minutes to relieve pain and deactivate toxins.
  - Apply a topical antihistamine or hydrocortisone cream to reduce itching and inflammation.
  - Scrapes:
  - Clean the wound with soap and water.
  - Apply an antibiotic ointment.
  - Cover with a sterile bandage or dressing.
  - Dehydration:
  - Encourage the person to drink water or a sports drink with electrolytes.
  - Rest in a cool, shaded area.
  - Heat Exhaustion:
  - Move the person to a cool, shaded area.
  - Loosen clothing and apply cool, wet cloths or ice packs to the skin.
  - Encourage sips of water.
  - Monitor for signs of heat stroke.
  - Heat Stroke:
  - Call emergency services immediately.
  - Move the person to a cooler place and remove excess clothing.
  - Cool the person rapidly with ice packs or cool water immersion.
  - Monitor their temperature until help arrives.
  - Hypothermia:
  - Remove wet clothing and cover the person with blankets or warm clothing.
  - Offer warm, sweet drinks if conscious.
  - Hyperthermia:
  - Move the person to a cooler environment.
  - Apply cool compresses to the forehead, neck, armpits, and groin.
  - Encourage sips of water if conscious.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `e364d637-954c-4cad-9536-34cacd2bbd80` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 110 - Cardiopulmonary Resuscitation (CPR):

- Page/scene number: 110
- Scene ID: `cf93506b-45c5-452b-83da-dc3999b647a9`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: First Aid Essentials for Snorkeling (slide 32, action `QzXvitOL5gbMtw_cCaF-D`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `cf93506b-45c5-452b-83da-dc3999b647a9`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `fbdfa533-400c-4b40-bcf7-62ca78a0f046` (title_1):
  - Cardiopulmonary Resuscitation (CPR):
- Text object `849793ef-00ec-4ee4-9517-2a5408c741c1` (content):
  - Check the Scene: Ensure the area is safe for you and the victim.
  - Assess Responsiveness: Tap the victim's shoulder and shout, "Are you okay?"
  - Call for Help: If the victim is unresponsive, call emergency services immediately.
  - Open Airway: Tilt the victim's head back slightly and lift the chin.
  - Check for Breathing: Look, listen, and feel for breathing for 5-10 seconds. If not breathing normally, start CPR.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `c712bb54-c81e-4921-bcdd-a0d8aad6ad16` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 111 - Traditional J- Shape

- Page/scene number: 111
- Scene ID: `d31499f4-ca0e-4a8e-b313-7d750d882cdd`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Snorkels (slide 10, action `igyPIWGkRuvziR8KuUzQj`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `d31499f4-ca0e-4a8e-b313-7d750d882cdd`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `98dde219-d1d6-4481-a801-e5ed1f5947b0` (title_1):
  - Traditional J- Shape
- Text object `431afdfc-4cd3-421c-91f8-8e1cac693eeb` (content):
  - Benefits: Simple and affordable design, easy to use for beginners.Drawbacks: Requires forceful exhalation to clear water, which can be inconvenient and disrupt breathing rhythm.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/5e0fd277-8f2f-427e-b66b-54d0ed420476.png` (source `be497e99-138b-4fbd-a524-3f472a800e08`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b5300777-e1d8-4f14-9d43-d1df957603d9` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 112 - Heat Transfer

- Page/scene number: 112
- Scene ID: `d7144ab4-6c73-4524-bbb2-cac35652af32`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physiology (slide 18, action `MYuQDuPkNglanu2vmuP6z`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `d7144ab4-6c73-4524-bbb2-cac35652af32`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `3d50b4c5-1c71-4861-9397-ec5838bf157b` (title_1):
  - Heat Transfer
- Text object `e99e0d3d-1772-4d15-96ae-0bdc42583ae9` (content):
  - Essential in underwater activities to prevent both hypothermia and hyperthermia. Water conducts heat more efficiently than air, causing body temperature to drop faster in cold water. Wearing appropriate thermal protection like wetsuits or rash guards helps retain body heat and prevents hypothermia, especially in colder water conditions. Conversely, in warm water, overheating can occur, so it's essential to stay hydrated and take breaks when necessary to avoid heat-related illnesses.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/d314dace-8182-4771-bc56-02fde12a3574.jpeg` (source `c0dff161-de4d-4903-83f5-e432929fe3df`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `2b23ae73-2175-4ef1-963f-8d6c16ed86f6` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 113 - Light

- Page/scene number: 113
- Scene ID: `db9cd1c8-834a-451d-9a01-cead44d97ae5`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physics (slide 17, action `3u_o42mwcF8BJ50bTTmtT`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `db9cd1c8-834a-451d-9a01-cead44d97ae5`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `cb92d4c6-3ade-400c-bd9b-9119cda63e84` (title_1):
  - Light
- Text object `09c312d0-8126-453f-88e8-8713b01097c1` (content):
  - Light behaves differently underwater, with colors becoming less vibrant and distinct as depth increases due to the absorption of different wavelengths by water molecules. Refraction and magnification of light also occur underwater, distorting the perception of objects' size and distance. Understanding these effects is essential for divers to navigate safely and appreciate the underwater environment fully.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/8e091e0d-0cab-440a-a0eb-57a837e6244f.png` (source `759d8360-7248-47e5-b788-6c1dd49259ce`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `b7f0be20-95e4-42ef-b789-84a9d9ddb570` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 114 - Hypercapnia

- Page/scene number: 114
- Scene ID: `dc3e6efe-b8a9-4094-b275-ed4218b849b2`
- Original Genially name: ` Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physiology (slide 18, action `XygbeWP-K4KRX3uBhLL4y`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `dc3e6efe-b8a9-4094-b275-ed4218b849b2`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `e8e7ec90-4ff2-4633-a428-ed6822663219` (title_1):
  - Hypercapnia
- Text object `ceca56b5-6a25-4fa0-b80b-1df506d0c04f` (content):
  - Hypercapnia occurs when there's an excessive buildup of carbon dioxide (CO2) in the bloodstream, leading to elevated levels of CO2 in the body. This can happen when a snorkeler breathes too quickly or inefficiently, causing inadequate CO2 removal from the body. Symptoms of hypercapnia include dizziness, confusion, headache, and in severe cases, loss of consciousness.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/03c7df0b-d245-44e4-a210-c4c42224b7d5.png` (source `b3c940df-25f1-4d79-9a5c-79c31973289a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `2125cb40-c776-48e3-bde1-ddc0d218155e` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 115 - CO2 Effects and First Aid

- Page/scene number: 115
- Scene ID: `de6be6ae-b826-44d6-be86-c26d5d9015c0`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physiology (slide 18, action `uYilbMdhjYtQRf--Dq35y`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `de6be6ae-b826-44d6-be86-c26d5d9015c0`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `cbd9d53c-2884-478d-8a6a-a9695d7e073d` (title_1):
  - CO2 Effects and First Aid
- Text object `7539e252-0ee4-46ec-8b13-5c97a74270ad` (content):
  - Understanding the Needs of a Victim
  - Recognizing Critical Symptoms:
  - When snorkeling, it's vital to be aware of symptoms that may indicate serious issues like hypercapnia, hypocapnia, or shallow water blackout. Watch for:
  - - Disorientation or confusion
  - - Unusual fatigue or dizziness
  - - Muscle cramping or tingling sensations
  - - Loss of consciousness or responsiveness
  - - Essential Response Actions:
  - Immediate Assistance: If you notice someone exhibiting any concerning symptoms, ensure their flotation and keep their head above water. Do not attempt rescue breathing or CPR unless you are trained. For a person experiencing a shallow water blackout, it's crucial to support them to ensure they are breathing once at the surface.
  - Alerting Authorities: Immediately signal for help. Use a whistle, wave to shore, or send another member of your party to get assistance. Clearly communicate the victim's condition to lifeguards, emergency responders, or medical professionals upon their arrival.
  - Providing Essential Aid: While waiting for professional help, continue to monitor the victim's responsiveness and breathing. Offer reassurance and keep them calm and still.
  - Do not provide food, drink, or medication. Allow professionals to assess and administer necessary interventions.
  - Guidance for Untrained Responders:
  - Calling for Help: If you're unsure about the victim's condition or how to respond, call for emergency services immediately. Time is critical in aquatic emergencies.
  - Preventing Further Risk: Keep yourself safe. Do not attempt a rescue that puts you in danger. Use a flotation device or a reach tool to assist without compromising your safety.
  - Gathering Information: While maintaining a safe environment, try to collect details about the incident and the victim's condition to relay to emergency personnel upon their arrival.
  - Preventative Advice: Encourage all snorkelers to be conscious of their breathing patterns and avoid risky behaviors like hyperventilation. Awareness and respect for one's limits in the water can prevent many emergencies.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `5488dcde-f018-43e4-88f1-d37df69ea943` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 116 - Bony Fish

- Page/scene number: 116
- Scene ID: `e0c28eda-262c-40dd-a34c-f83c46aa67f6`
- Original Genially name: ` Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Aquatic Life (slide 16, action `G4xxMBUzh3BnCnLocOTNT`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `e0c28eda-262c-40dd-a34c-f83c46aa67f6`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `b7d92bbc-b1b6-45d7-a1e2-4763c1211297` (title_1):
  - Bony Fish
- Text object `867f8dda-bdee-4bd0-b806-3f83bcf57a1f` (content):
  - Also known as teleosts, are the most diverse group of fish in the ocean. They have skeletons made of bone and are characterized by their swim bladders, which help them control buoyancy. Look for features like scales, fins, and gills to identify bony fish during your snorkeling adventures.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/23689707-629b-4a0b-9d27-6b2f74d1817b.png` (source `a0c8c683-486d-4fda-b163-d5565f091ae3`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `fbc3b6c0-89d1-4627-abb8-220825877a43` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 117 - Long Hair: Unwanted and strangling hair can cause unneccesary stress while snorkeling. We reccomend tying the hair back 

- Page/scene number: 117
- Scene ID: `e2b7ac7e-3325-4a1a-8ce8-df724f90ce43`
- Original Genially name: ` Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Pre Snorkel Routine (slide 21, action `wr_J_7o18wVqLHkMcnUXS`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `e2b7ac7e-3325-4a1a-8ce8-df724f90ce43`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `6aa2c975-c032-4277-ab46-57bd3f2c464c` (title_1):
  - Long Hair: Unwanted and strangling hair can cause unneccesary stress while snorkeling. We reccomend tying the hair back in a low pony tail, then braiding the pony tail and adding another hair band at the bottom.
  - Bangs: For short hair in the front that can't be tied back, use a head band to help push hair out of the way. (always make sure there is no hair in your mask seal.)
  - Facial Hair: If you have a mustache, shave a small thin line below the nose, to ensure the mask can seal. If this is not possible, use petroleum jelly on the mustache, this will create a seal for the mask.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/195aea74-ea68-46c5-8a43-53ef9c33cf68.png` (source `dc8b3dd9-55bf-4823-a4b0-22667d50bc42`)
- image: `images/bd8eea2e-1364-4028-af04-371ab9252ac7.png` (source `fb9db0e5-5100-453e-819e-9c7988b4e207`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `a0b8a334-c269-4631-92b6-74705d8065d8` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 118 - Importance of Equalizing

- Page/scene number: 118
- Scene ID: `e3d4a6a4-3d7d-432c-9ad5-1c23ec9b2876`
- Original Genially name: ` Copy Copy Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Equalizing and Decent (slide 19, action `jhmdIUtXZlXfmsbw4Knnh`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `e3d4a6a4-3d7d-432c-9ad5-1c23ec9b2876`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `de76607b-288c-4965-8647-01b03668cbcd` (title_1):
  - Importance of Equalizing
- Text object `151b0d6b-0daa-4af3-85fc-d09154067fc6` (content):
  - Before delving into the depths of the ocean, it's essential to understand the concept of equalizing and its importance in maintaining comfort and safety underwater. As we descend beneath the surface, the increasing water pressure compresses the air spaces in our body, particularly in the sinuses and middle ear. Failure to equalize these air spaces can result in discomfort, pain, and even injury, known as barotrauma. Therefore, mastering equalizing techniques is crucial for all divers.
  - As we descend below 0.5 meters, the pressure on our bodies increases. This pressure change affects the air spaces in our ears and sinuses, causing discomfort if not equalized. Equalizing involves adjusting the pressure in these air spaces to match the surrounding water pressure, thus preventing barotrauma.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `632af711-a95f-419b-88ed-e22602602c54` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 119 - After Care

- Page/scene number: 119
- Scene ID: `e41ce519-d846-4b62-a179-8185fee0e6e4`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `XRBR3lQ8gyOvz7q43QJrM`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `e41ce519-d846-4b62-a179-8185fee0e6e4`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `567a0e37-7875-460e-a18d-7f1645785f0d` (title_1):
  - After Care
- Text object `c06ca258-e733-4d4d-8544-99e9135e4328` (subtitle):
  - Rinse mask thoroughly with fresh water.
  - Scrup witha non abbrasive dish soap and toothbrush, if any gunk is present.
  - Allow mask to dry compleatly before storing
  - Avoid drying the mask in direct sunlight.
- Text object `65eeb48a-4f07-4c28-bc67-5e463475a597` (title_1):
  - Mold Prevention
- Text object `95d18a57-9040-471d-b30e-4fcfc870d1e2` (subtitle):
  - Ensure the mask is fully dry before storing.
  - If mold is found, soak the mask in white vinegar, then scrub with a soft brush.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/0b292779-7e10-4bbd-9a7f-d29fe5db4c64.png` (source `eff16590-03fd-43e1-85dd-475b3d61431a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `8e1568ab-40bd-456c-8260-1b2816e7782d` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 120 - Buckle Mastery

- Page/scene number: 120
- Scene ID: `e687713a-50f9-4be8-bfca-49490be08f1e`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `KmSGNW7R3CkR-1wxWW10J`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `e687713a-50f9-4be8-bfca-49490be08f1e`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `8b04e442-1ff9-497a-b1e0-cd378be35bf0` (title_1):
  - Buckle Mastery
- Text object `033b3a4e-d3dd-4f76-828e-511f344bd367` (title_1):
  - Tighten
- Text object `cda1bb15-dab3-4662-90ef-ec5d20d09bbb` (title_1):
  - Loosen
- Text object `d154a4f6-b741-453e-a6ec-3b45d775f846` (content):
  - Check carefully how your buckles work.
  - Loosen and tighten straps to get familiar with buckles.
  - Be gentle with the buckles so they last longer.
  - Leave buckles loose.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/35d2cc11-af68-4ebe-816a-f171e2c83302.gif` (source `77113ca9-98d4-4b6c-bee5-ac69e85cfd54`)
- image: `images/181fee36-66c4-46e2-b582-6ec6a8e32cd7.gif` (source `1f1dcd92-0254-4dce-a5e3-c147df836390`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `101b0ce0-9409-4b02-a45a-106492810739` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 121 - Buoyancy

- Page/scene number: 121
- Scene ID: `e765eed6-30de-4954-b7e1-09ff3308ac80`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Physics (slide 17, action `G2_37kPV0WGodL2-lqzwN`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `e765eed6-30de-4954-b7e1-09ff3308ac80`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `8575ee8e-9ccc-47b6-8ba0-6fec740afef7` (title_1):
  - Buoyancy
- Text object `f807db45-6d9c-463c-b54d-8409acd28574` (content):
  - A fundamental principle in physics, it plays a crucial role in snorkeling and scuba diving. It's the force that enables objects to float in a fluid, and it's governed by Archimedes' principle. When immersed in water, our bodies experience an upward force equal to the weight of the water displaced. This buoyant force allows us to float effortlessly at the surface. In saltwater, where the density is higher than freshwater, buoyancy is more pronounced, making it easier to float.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/8f321946-ccd7-495e-a02e-4ba9fcd83007.png` (source `90f35ba0-7b30-4cee-ae60-e6c765782aa8`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `dfa78285-bbf2-4380-aa20-323abec856cf` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 122 - Donning the Mask

- Page/scene number: 122
- Scene ID: `eb2d7afa-9cc8-499b-af4d-ca43bc040b44`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `oDhKfv53RzwJUj67EGgDk`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `eb2d7afa-9cc8-499b-af4d-ca43bc040b44`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `1d62d563-140a-4df0-a618-f702665219ff` (title_1):
  - Donning the Mask
- Text object `cc3816a1-a226-4653-b566-c6f5d24b4bfd` (content):
  - Before putting on the mask, it's essential to loosen the straps to prevent discomfort.
  - Mask Placement:
  - Hold the mask strap with two hands, start by placing the back of the strap on the crown of your head, then pull the mask forward till it sits comfortably. Adjust as needed. Make sure the mask fully covers the nose, with as little coverage on the upper lip as possible.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/742bde97-c247-42e9-b703-9d3e198fd5da.gif` (source `80529653-7d33-49f3-9f61-7d458cfd45ed`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `3c084b4c-342e-4be4-b512-b0a44f8bbfbf` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 123 - After Care

- Page/scene number: 123
- Scene ID: `ed668472-fb88-44bf-8eca-f85b23c50bd9`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Snorkels (slide 10, action `owT1TcPuYR4vPbgZMHsfO`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `ed668472-fb88-44bf-8eca-f85b23c50bd9`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `d7d5d3e3-5e0d-417c-89dc-928c41d132bf` (title_1):
  - After Care
- Text object `a70f8307-e6db-47eb-a75a-83f5111d3b14` (subtitle):
  - Rinse snorkel thoroughly with fresh water.
  - Scrup with a non abbrasive dish soap and toothbrush, if any gunk is present.
  - Allow snorkel to dry compleatly before storing
  - Avoid drying the snorkel in direct sunlight.
- Text object `2a8477f7-be1c-4a5e-b11d-4cac47dc65ee` (title_1):
  - Mold Prevention
- Text object `62f19c8d-425b-4e36-993a-e5c3a443795d` (subtitle):
  - Ensure the snorkel is fully dry before storing.
  - If mold is found, soak the snorkel in white vinegar, then scrub with a soft brush.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/0b292779-7e10-4bbd-9a7f-d29fe5db4c64.png` (source `651c1171-205a-45bc-8975-6269d540ca72`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `98561c2d-6c8e-4fa9-83dc-56ab6883de34` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 124 - Floating and Treading Water: Essential Surface Skills

- Page/scene number: 124
- Scene ID: `f36b8b53-66ef-445c-ae49-bab0f237b4e2`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Swimming Techniques (slide 30, action `wAFxFsWe_HdgsYzSJ1bA3`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `f36b8b53-66ef-445c-ae49-bab0f237b4e2`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `a506d7c8-81d4-48e9-a6e2-c84ed44ffcfb` (title_1):
  - Floating and Treading Water: Essential Surface Skills
- Text object `53f3ddce-14d2-44a7-9387-613abc554454` (content):
  - Mastering Buoyancy: Techniques for Effortless FloatingRelax and Distribute Weight: Lie flat on your back in the water, keeping your body as straight as possible. Spread your arms out to the sides and extend your legs slightly. Relax your muscles and focus on staying calm.
  - Control Your Breathing: Take slow, deep breaths and allow your lungs to fill with air. This helps increase buoyancy and keeps you afloat. Keep your face out of the water and your chin tilted slightly upward.
  - Use Your Lungs: Your lungs act as natural floatation devices. By inhaling deeply, you increase your buoyancy and stay afloat more easily. Exhale slowly and evenly to maintain your position on the water's surface.
  - Practice Relaxation Techniques:
  - If you find yourself sinking, try to relax your body further and spread your arms and legs out wider. Visualize yourself as light and buoyant, gently floating on the water.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `1b697534-2196-432c-a32e-3a3b001941ea` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 125 - Longshore Currents

- Page/scene number: 125
- Scene ID: `f3c193d1-72d9-473e-909a-99284f7b2be4`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Academics
- Popup source: Enviroment (slide 15, action `WGs0E0VrtkMN3MOn1-hFc`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `f3c193d1-72d9-473e-909a-99284f7b2be4`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `52991c7a-6f78-442f-ab84-db915282d3fd` (title_1):
  - Longshore Currents
- Text object `beef377e-3e6b-4b11-a399-bb24a2d282b1` (content):
  - Longshore currents flow parallel to the shore and are generated by waves hitting the coastline at an angle. These currents can influence lateral movement while snorkeling near the shore and may impact entry and exit points.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/6cd5c3ff-5a39-4f3e-af54-21755b1ad32e.jpeg` (source `3522128d-c4c7-4825-b08f-0b399e05af62`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `52ecc09d-ab83-4b62-8478-217fb781e9e1` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 126 - Exit

- Page/scene number: 126
- Scene ID: `f7ccea8f-378f-4af9-86db-bc0afc8002ac`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Entry & Exit (slide 22, action `Dh-rx4-Z3L0Fnztq2wWRQ`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `f7ccea8f-378f-4af9-86db-bc0afc8002ac`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `2df13812-0e7f-480a-9ce4-2730be17d25d` (title_2):
  - Exit
- Text object `1d4c980c-f02b-460f-ab88-58bef37975f0` (title_1):
  - Finally, let's talk about how to exit the water safely and gracefully. Whether we're climbing out onto a beach or using a ladder on a boat, we must take our time and be careful.
  - Shore: Head into the shallow waters by the shore, if it's calm get somewhere you can sit, remove fins and when you're ready stand up and walk out. *if it's choppy then keep facing the ocean and walk backwards slowly, try to stand still when waves are coming in.
  - Boat Ladder: Most ladders are difficult to climb with fins. Make contact with the ladder and remove 1 fin and pass it up to someone on the boat. Swap hands maintaining contact and remove the other fin and pass it up. Then slowly climb the ladder.
  - *Safety advice - Don’t get close to the ladder when someone is climbing it. If it's choppy, give more space and go slower.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `fc831672-df17-4a08-81f1-998e167c5e6f` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 127 - Heal of Hand Press

- Page/scene number: 127
- Scene ID: `fb948d14-f6ac-47f9-9242-389cc68ef290`
- Original Genially name: ` Copy Copy Copy Copy`
- Type: Popup/modal slide
- Original section: Open Water
- Popup source: Mask Clearing (slide 25, action `Hq_rV0OtmyRhgAnknqpH4`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `fb948d14-f6ac-47f9-9242-389cc68ef290`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `bd1d21a1-b768-45c7-844d-7ec7be50b896` (title_1):
  - Heal of Hand Press
- Text object `32722637-9b65-465c-a00a-a78fef54a095` (content):
  - Firmly push heel of hand against the middle of the top frame.
  - Take a nice big breath in through your mouth
  - Continuously breath out of your nose whilst lifting your chin up and looking towards the sky
  - And there you go, should be clear of water: if there is still some water just repeat steps 2 & 3.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/8338712a-511a-497b-9fae-c08c24771c4d.gif` (source `e84b55f3-e35a-4f4f-a78e-29266603425a`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `cbdbf595-461e-4cb3-bc12-9e946139fe8b` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 128 - Mask Positioning and Adjustment

- Page/scene number: 128
- Scene ID: `fcf822e2-e7f9-4c81-96dd-1cbdb32434a5`
- Original Genially name: `N/A`
- Type: Popup/modal slide
- Original section: Equipment
- Popup source: Masks (slide 9, action `ihVMmt6tf5YA2gRzvx-SJ`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `fcf822e2-e7f9-4c81-96dd-1cbdb32434a5`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `2bafea6f-aefd-48e0-814a-22b173d85767` (title_1):
  - Mask Positioning and Adjustment
- Text object `8941cb73-be8b-4ea2-96e8-966135c54a79` (content):
  - Adjust the mask so that it sits as high on your face as possible while still fully covering your nose. This ensures a secure fit and prevents water from entering.
  - The back strap should rest comfortably on the crown of your head, with the strap positioned above your ears.
  - Adjusting the Strap:
  - Gently pull the excess strap to tighten the mask around your face, ensuring a snug and comfortable fit.
  - Remember to adjust both sides evenly to maintain a good seal and prevent leaks.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- image: `images/ff85d55b-bbdb-4676-b9cf-33761b35e7d3.gif` (source `cdac627c-e09a-4d54-a853-361959c4e5fb`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `13966d31-c9e4-4a77-bf1a-16f70f2b3824` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup

### 129 - Treading Water Life Saving tips:

- Page/scene number: 129
- Scene ID: `fe015cf2-28ce-45d8-9b6d-2cdcf0663b6f`
- Original Genially name: ` Copy`
- Type: Popup/modal slide
- Original section: Extra Tips & Resources
- Popup source: Swimming Techniques (slide 30, action `c2iSjtOOzLP0ffLrxOd4T`)
- Source location: Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON. Slide object with ID `fe015cf2-28ce-45d8-9b6d-2cdcf0663b6f`; related Texts/Images/Svgs filtered by `IdSlide`.

#### Title / Subtitle / Body Copy

- Text object `cbfdf42c-a577-4483-9c93-1a8856a8608e` (title_1):
  - Treading Water Life Saving tips:
- Text object `818f422d-86d5-47bd-95ed-619bcf1b1321` (content):
  - Stay Upright: Keep your body vertical in the water, with your head and shoulders above the surface. Maintain a relaxed posture and avoid tensing up.
  - Downward Kick: Perform a downward frog kick by pushing down with both your legs, then raising them up and bringing them together in a circular motion. This motion helps propel you upward and keeps you afloat.
  - Circular Hand Motion: Use your hands to create a circular motion in the water, with your palms facing downward. Sweep your hands outward and downward, then bring them back together in front of your body. This motion provides additional support and stability while treading water.
  - Find Your Rhythm: Coordinate your frog kick with your circular hand motion to maintain a steady rhythm. Focus on keeping your movements smooth and controlled to conserve energy.
  - Control Your Breathing: Take slow, steady breaths and avoid hyperventilating. Try to establish a breathing pattern that matches your movements to help you stay relaxed and comfortable in the water.
  - Stay Calm: Treading water can be tiring, especially if you're not used to it. Stay calm and conserve your energy by focusing on your technique and breathing. If you need to rest, roll onto your back and float for a moment before resuming treading water.
  - Tips & Common Mistakes:
  - Keep your movements small and controlled to conserve energy and maintain balance.
  - Focus on maintaining a steady rhythm and pace throughout the exercise.
  - Use your arms and legs together in a coordinated motion to maximize efficiency and propulsion.
  - Kicking too forcefully or too rapidly, which can cause you to tire quickly and expend unnecessary energy.
  - Holding your breath instead of breathing steadily, which can lead to fatigue and discomfort.
  - Allowing your legs to sink below the surface, which can make treading water more difficult and require more effort to stay afloat.
  - Leaning too far forward or backward, which can disrupt your balance and stability and make it harder to maintain an upright position.

#### Media

- background: `images/backgroundStandard.png` (source `slide.Background`)
- video: none recovered in `Videos`; no local video objects detected.

#### Links and Navigation

- click on svg `449b29f1-d3b3-45e3-b309-6de9db3fe847` (svg/SourceSvg;u/tVKnMmSW9Fn4f7VJA4HxI4AiwVg3envEF25sKLRQI=): closeSlidePopup
