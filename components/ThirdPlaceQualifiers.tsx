"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";
import toast from "react-hot-toast";
import { getFlagUrl } from "../app/utils/flags";

export default function ThirdPlaceQualifiers({ groups, userId, tournamentState = 0 }: any) {
  const groupNames = Object.keys(groups).sort();
  const [activeGroup, setActiveGroup] = useState(groupNames[0] || "A");

  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [userQualifiers, setUserQualifiers] = useState<any>({});
  const [realThirdPlace, setRealThirdPlace] = useState<string[]>([]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isRandomizing, setIsRandomizing] = useState(false);

  const [showSpyModal, setShowSpyModal] = useState(false);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

  const [spySearchQuery, setSpySearchQuery] = useState("");
  const [spyFilter, setSpyFilter] = useState<"ALL" | "WITH_POINTS" | "MISS">("ALL");

  const isLoaded = useRef(false);
  const isUserAction = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tSnap = await getDoc(doc(db, "predictions_third_place", userId));
        if (tSnap.exists()) {
          const savedTeams = tSnap.data().teams || [];
          setSelectedTeams(savedTeams.filter((t: string) => t !== ""));
        }

        const qSnap = await getDoc(doc(db, "predictions_qualifiers", userId));
        if (qSnap.exists()) {
          setUserQualifiers(qSnap.data().groups || {});
        }

        const rSnap = await getDoc(doc(db, "admin_results", "third_place"));
        if (rSnap.exists()) {
          const rTeams = rSnap.data().teams || [];
          setRealThirdPlace(rTeams.filter((t: string) => t !== ""));
        }
      } catch (e) {
        console.error(e);
      } finally {
        isLoaded.current = true;
      }
    };
    if (userId) fetchData();
  }, [userId]);

  useEffect(() => {
    if (!isLoaded.current || !isUserAction.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const paddedTeams = [...selectedTeams];
        while (paddedTeams.length < 8) paddedTeams.push("");

        await setDoc(
          doc(db, "predictions_third_place", userId),
          { teams: paddedTeams, updatedAt: new Date() },
          { merge: true }
        );
        setSaveStatus("saved");
        isUserAction.current = false;
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (e) {
        setSaveStatus("idle");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedTeams, userId]);

  const checkIsAlreadyAdvanced = (team: string) => {
    for (const group of Object.values(userQualifiers)) {
      const g = group as any;
      if (g.first === team || g.second === team) return true;
    }
    return false;
  };

  const toggleTeam = (team: string, groupName: string) => {
    if (isLocked) return;
    isUserAction.current = true;

    if (selectedTeams.includes(team)) {
      setSelectedTeams((prev) => prev.filter((t) => t !== team));
    } else {
      if (
        selectedTeams.length >= 8 &&
        !selectedTeams.find((t) => Array.from(groups[groupName] as Set<string>).includes(t))
      ) {
        toast.error("כבר בחרת 8 נבחרות! בטל בחירה קיימת (X בסלוט למעלה) כדי לבחור אחרת.");
        return;
      }

      if (checkIsAlreadyAdvanced(team)) {
        toast("שמנו לב שכבר העלית את הנבחרת הזו ממקום 1/2. זכותך לגדר סיכונים, אבל שים לב!", {
          icon: "⚠️",
          style: { background: "#334155", color: "#fbbf24", border: "1px solid #fbbf24" },
        });
      }

      const teamsInThisGroup = Array.from(groups[groupName] as any[]);
      const alreadySelectedFromGroup = selectedTeams.find((t) => teamsInThisGroup.includes(t));

      if (alreadySelectedFromGroup) {
        setSelectedTeams((prev) => [...prev.filter((t) => t !== alreadySelectedFromGroup), team]);
      } else {
        setSelectedTeams((prev) => [...prev, team]);
      }
    }
  };

  const handleRemoveTeam = (team: string) => {
    if (isLocked) return;
    isUserAction.current = true;
    setSelectedTeams((prev) => prev.filter((t) => t !== team));
  };

  const isLocked = tournamentState >= 1;

  const handleRandomizeThirdPlace = async () => {
    if (isLocked) return;

    toast((t) => (
      <div className="flex flex-col gap-3 text-right" dir="rtl">
        <span className="font-bold text-slate-800 text-sm">להגריל 8 נבחרות אקראיות מתוך הבתים השונים? <br/><span className="text-[10px] font-normal text-rose-500">*פעולה זו תדרוס את הבחירות הקיימות שלך.</span></span>
        <div className="flex gap-2">
          <button onClick={() => {
            toast.dismiss(t.id);
            setIsRandomizing(true);
            isUserAction.current = true;

            try {
              const allGroupNames = Object.keys(groups);
              // הגרלת 8 בתים אקראיים
              const shuffledGroups = [...allGroupNames].sort(() => 0.5 - Math.random()).slice(0, 8);

              const newSelectedTeams: string[] = [];
              shuffledGroups.forEach((gName) => {
                const teamsInGroup = Array.from(groups[gName] as Set<string>);
                // סינון נבחרות שכבר העפילו ממקום 1 או 2
                const availableTeams = teamsInGroup.filter((t) => !checkIsAlreadyAdvanced(t));

                if (availableTeams.length > 0) {
                  newSelectedTeams.push(availableTeams[Math.floor(Math.random() * availableTeams.length)]);
                } else if (teamsInGroup.length > 0) {
                  newSelectedTeams.push(teamsInGroup[Math.floor(Math.random() * teamsInGroup.length)]);
                }
              });

              setSelectedTeams(newSelectedTeams);
              toast.success("🎲 8 נבחרות הוגרלו בהצלחה!");
            } catch (e) {
              console.error(e);
              toast.error("שגיאה בביצוע ההגרלה.");
            } finally {
              setIsRandomizing(false);
            }
          }} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95">כן, הגרל</button>
          <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">בטל</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const calculateUserPoints = (userTeams: string[]) => {
    if (realThirdPlace.length === 0) return null;
    let pts = 0;
    userTeams.forEach((t) => {
      if (realThirdPlace.includes(t)) pts += 10;
    });
    return pts;
  };

  const handleOpenSpy = async () => {
    setShowSpyModal(true);
    setSpySearchQuery("");
    setSpyFilter("ALL");
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: any[] = [];
      usersSnap.forEach((doc) => allUsers.push({ id: doc.id, ...doc.data() }));

      allUsers.sort((a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0));
      let currentRank = 1;
      const usersMap: any = {};
      allUsers.forEach((u, i) => {
        if (i > 0 && (Number(u.totalPoints) || 0) < (Number(allUsers[i - 1].totalPoints) || 0)) {
          currentRank = i + 1;
        }
        usersMap[u.id] = {
          name: u.name || "שחקן לא ידוע",
          totalPoints: Number(u.totalPoints) || 0,
          rank: currentRank,
        };
      });

      const tSnap = await getDocs(collection(db, "predictions_third_place"));
      const gathered: any[] = [];
      tSnap.forEach((doc) => {
        const userTeams = (doc.data().teams || []).filter((t: string) => t !== "");
        if (userTeams.length > 0) {
          gathered.push({
            userId: doc.id,
            userName: usersMap[doc.id]?.name || "משתמש",
            userTotalPoints: usersMap[doc.id]?.totalPoints || 0,
            userRank: usersMap[doc.id]?.rank || 999,
            teams: userTeams,
            points: calculateUserPoints(userTeams),
          });
        }
      });
      gathered.sort((a, b) => b.userTotalPoints - a.userTotalPoints);
      setSpyData(gathered);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSpy(false);
    }
  };

  const currentIndex = groupNames.indexOf(activeGroup);
  const handlePrevGroup = () => {
    const prevIndex = currentIndex === 0 ? groupNames.length - 1 : currentIndex - 1;
    setActiveGroup(groupNames[prevIndex]);
  };
  const handleNextGroup = () => {
    const nextIndex = currentIndex === groupNames.length - 1 ? 0 : currentIndex + 1;
    setActiveGroup(groupNames[nextIndex]);
  };

  const myPoints = calculateUserPoints(selectedTeams);

  const currentGroupTeams = Array.from((groups[activeGroup] as Set<string>) || []);
  const selectedFromActiveGroup = selectedTeams.find((t) => currentGroupTeams.includes(t));

  const hasTruth = realThirdPlace.length > 0;
  const spyStats = { withPoints: 0, miss: 0 };

  if (hasTruth) {
    spyData.forEach((d) => {
      if (d.points && d.points > 0) spyStats.withPoints++;
      else spyStats.miss++;
    });
  }

  const filteredSpyData = spyData.filter((d) => {
    if (!d.userName.toLowerCase().includes(spySearchQuery.toLowerCase())) return false;
    if (hasTruth && spyFilter !== "ALL") {
      if (spyFilter === "WITH_POINTS" && (!d.points || d.points === 0)) return false;
      if (spyFilter === "MISS" && d.points && d.points > 0) return false;
    }
    return true;
  });

  // חישוב מד ההתקדמות עבור מקום שלישי!
  const progressPercent = Math.round((selectedTeams.length / 8) * 100);

  return (
    <div className="w-full animate-fade-in-up">
      {/* אזור העגלה - כווץ והודק! */}
      <div className="bg-slate-900/80 p-4 md:p-6 rounded-3xl border border-teal-500/30 mb-6 shadow-2xl relative md:sticky md:top-20 z-30 backdrop-blur-md">
        
        {/* --- פס התקדמות --- */}
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-teal-500/30 shadow-inner mb-6">
          <div className="flex justify-between items-end mb-2">
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] font-black tracking-widest uppercase">
                התקדמות בחירה
              </span>
              <span className="text-white font-bold text-sm">
                בחרת <span className="text-teal-400">{selectedTeams.length}</span> מתוך 8 נבחרות
              </span>
            </div>
            <span className="text-teal-400 font-black">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
            <div
              className="h-full bg-gradient-to-l from-teal-400 to-emerald-500 rounded-full transition-all duration-500 ease-out relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] skew-x-12"></div>
            </div>
          </div>
          {progressPercent === 100 && (
            <div className="text-center mt-2.5 text-[11px] text-emerald-400 font-bold animate-pulse">
              🏆 מושלם! בחרת את כל 8 המעפילות מהמקום השלישי.
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <h2 className="text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 mb-1">
              8 המעפילות מהמקום השלישי
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mb-2">
              בחר את 8 הנבחרות שלדעתך יעפילו לשלב הבא מהמקום השלישי.
            </p>
            <div className="flex items-center gap-1.5 text-amber-400 text-[10px] sm:text-xs font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 w-fit">
              <span>💡</span> מותרת רק נבחרת אחת מכל בית
            </div>
          </div>

          <div className="flex flex-col items-end gap-2.5 w-full md:w-auto mt-2 md:mt-0">
            {myPoints !== null && (
              <div
                className={`px-4 py-2 rounded-xl border shadow-lg ${
                  myPoints > 0
                    ? "bg-purple-600/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] text-purple-400"
                    : "bg-slate-800 border-slate-700 text-slate-500"
                }`}
              >
                <span className="font-bold text-xs ml-1">ניקוד:</span>
                <span className="text-xl font-black">{myPoints > 0 ? `+${myPoints}` : "0"}</span>
              </div>
            )}

            <div className="flex items-center gap-3 w-full justify-end">
              {saveStatus === "saving" && (
                <span className="text-amber-400 text-[10px] animate-pulse font-bold">
                  ⏳ שומר...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-emerald-400 text-[10px] font-bold">✓ נשמר</span>
              )}

              {!isLocked ? (
                <button
                  onClick={handleRandomizeThirdPlace}
                  disabled={isRandomizing}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-600 transition-all active:scale-95"
                >
                  🎲 הגרל הכל
                </button>
              ) : (
                <span className="bg-rose-500/10 text-rose-400 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-rose-500/30">
                  🔒 נעול
                </span>
              )}
            </div>
          </div>
        </div>

        {/* הסלוטים של 8 הנבחרות */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2.5 mt-4">
          {Array.from({ length: 8 }).map((_, i) => {
            const team = selectedTeams[i];
            const isWarning = team ? checkIsAlreadyAdvanced(team) : false;

            return (
              <div
                key={i}
                className={`relative flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all h-24 group ${
                  team
                    ? "bg-slate-800 border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.15)] hover:-translate-y-1"
                    : "bg-slate-950/50 border-slate-700 border-dashed"
                }`}
              >
                {team ? (
                  <>
                    {isWarning && (
                      <div
                        className="absolute -top-2 -right-2 bg-slate-900 border border-amber-500 text-amber-400 rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black shadow-md z-10"
                        title="סתירה: בחרת להעלות אותה גם ממקום 1/2"
                      >
                        ⚠️
                      </div>
                    )}

                    {!isLocked && (
                      <button
                        onClick={() => handleRemoveTeam(team)}
                        className="absolute -top-2 -left-2 bg-rose-500 hover:bg-rose-400 rounded-full w-5 h-5 text-white text-[9px] font-black flex items-center justify-center border border-slate-900 shadow-md transition-all z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 active:scale-90"
                      >
                        ✕
                      </button>
                    )}

                    {getFlagUrl(team) ? (
                      <img
                        src={getFlagUrl(team)!}
                        className="w-8 h-5.5 object-cover rounded shadow-sm mb-1.5"
                        alt="flag"
                      />
                    ) : (
                      <span className="text-xl mb-1">🏳️</span>
                    )}
                    <span className="text-[11px] font-black text-white text-center leading-tight w-full break-words">
                      {team}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-600 text-2xl font-black opacity-20">{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        {isLocked && (
          <div className="mt-4 border-t border-slate-700/50 pt-4">
            <button
              onClick={handleOpenSpy}
              className="w-full py-2.5 rounded-xl font-bold text-[13px] transition-all border flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 shadow-sm active:scale-95"
            >
              <span>👁️</span> ריגול: מי ניחש מה?
            </button>
          </div>
        )}
      </div>

      {realThirdPlace.length > 0 && (
        <div className="mb-8 bg-purple-900/20 border border-purple-500/30 p-5 rounded-3xl shadow-inner relative z-10">
          <h3 className="text-purple-400 text-sm font-bold mb-3 flex items-center gap-2">
            <span>🏆</span> העפילו בפועל למקום ה-3 (תוצאות אמת):
          </h3>
          <div className="flex flex-nowrap overflow-x-auto custom-scrollbar pb-2 gap-2">
            {realThirdPlace.map((t) => {
              const isHit = selectedTeams.includes(t);
              return (
                <span
                  key={t}
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                    isHit
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] scale-105"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {getFlagUrl(t) && (
                    <img
                      src={getFlagUrl(t)!}
                      className="w-4 h-3 object-cover rounded-sm"
                      alt="flag"
                    />
                  )}
                  {t}
                  {isHit && (
                    <span className="ml-1 text-[10px] bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      🎯 +10
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto relative z-10">
        <div className="flex items-center justify-between w-full bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-md backdrop-blur-md mb-6">
          <button
            onClick={handlePrevGroup}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95"
          >
            <span className="text-lg leading-none">▶</span>
          </button>
          <div className="flex flex-col items-center justify-center flex-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              בית {activeGroup}
            </h2>
            {selectedFromActiveGroup ? (
              <span className="text-[9px] bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded font-bold border border-teal-500/30 mt-1 flex items-center gap-1">
                <span>✓</span> נבחרה ({selectedFromActiveGroup})
              </span>
            ) : (
              <span className="text-[9px] text-slate-500 font-bold mt-1">לא נבחרה נבחרת</span>
            )}
          </div>
          <button
            onClick={handleNextGroup}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95"
          >
            <span className="text-lg leading-none">◀</span>
          </button>
        </div>

        <div
          className={`bg-slate-800 rounded-3xl p-4 border transition-all ${
            selectedFromActiveGroup
              ? "border-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.05)] bg-teal-900/10"
              : "border-slate-700"
          } ${isLocked && myPoints === null ? "opacity-80 grayscale-[10%]" : ""}`}
        >
          <div className="flex flex-col gap-2.5">
            {currentGroupTeams.map((team) => {
              const isSelected = selectedTeams.includes(team);
              const isRealWinner = realThirdPlace.includes(team);
              const hasWarning = checkIsAlreadyAdvanced(team);

              let btnStyle = "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white";
              if (isSelected)
                btnStyle = "bg-teal-600 text-white border-teal-500 shadow-md transform scale-[1.02]";
              if (isLocked && !isSelected)
                btnStyle = "bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed";

              return (
                <button
                  key={team}
                  disabled={isLocked}
                  onClick={() => toggleTeam(team, activeGroup)}
                  className={`py-3 px-4 rounded-xl font-bold transition-all text-sm w-full text-right flex justify-between items-center border ${btnStyle} relative overflow-hidden group`}
                >
                  <div className="flex items-center gap-2.5 relative z-10">
                    {getFlagUrl(team) ? (
                      <img
                        src={getFlagUrl(team)!}
                        className="w-5 h-3.5 object-cover rounded-sm shadow-sm"
                        alt="flag"
                      />
                    ) : (
                      "🏳️"
                    )}
                    <span>{team}</span>
                  </div>

                  <div className="flex items-center gap-2 relative z-10">
                    {hasWarning && !isSelected && !isLocked && (
                      <span
                        className="text-[9px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="בחרת אותה במקום 1/2"
                      >
                        ⚠️ סתירה
                      </span>
                    )}
                    {isRealWinner && (
                      <span className="text-[9px] bg-purple-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                        העפילה
                      </span>
                    )}

                    {isSelected ? (
                      <span className="w-5 h-5 flex items-center justify-center bg-white/20 rounded-full text-white text-[10px]">
                        ✓
                      </span>
                    ) : !isLocked ? (
                      <span className="w-5 h-5 flex items-center justify-center bg-slate-800 rounded-full text-slate-500 text-base group-hover:text-white transition-colors">
                        +
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- חלון הריגול --- */}
      {showSpyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-slate-700 p-5 md:p-6 rounded-3xl w-full max-w-2xl md:max-w-[800px] md:min-w-[500px] min-h-[500px] h-[85vh] md:h-[650px] md:max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800 shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🕵️‍♂️</span> ריגול: 8 המעפילות מהמקום השלישי
              </h3>
              <button
                onClick={() => setShowSpyModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-bold border border-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 shrink-0">
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                <input
                  type="text"
                  placeholder="חפש חבר לליגה..."
                  value={spySearchQuery}
                  onChange={(e) => setSpySearchQuery(e.target.value)}
                  className="w-full bg-slate-950 text-white placeholder-slate-500 rounded-xl py-2.5 pr-10 pl-4 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all shadow-inner"
                />
              </div>
            </div>

            {hasTruth && (
              <div className="flex justify-center gap-2 mb-4 shrink-0">
                <button
                  onClick={() => setSpyFilter("ALL")}
                  className={`py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1 ${
                    spyFilter === "ALL"
                      ? "bg-slate-700 text-white border-slate-500 shadow-sm"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  הכל ({spyData.length})
                </button>
                <button
                  onClick={() => setSpyFilter("WITH_POINTS")}
                  className={`py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${
                    spyFilter === "WITH_POINTS"
                      ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  🎯 פגעו משהו ({spyStats.withPoints})
                </button>
                <button
                  onClick={() => setSpyFilter("MISS")}
                  className={`py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${
                    spyFilter === "MISS"
                      ? "bg-rose-900/40 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.1)]"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  ❌ לא פגעו בכלום ({spyStats.miss})
                </button>
              </div>
            )}

            <div className="overflow-y-auto custom-scrollbar flex-1 pl-2 md:pl-4 pr-1 pb-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-bold">
                  טוען ניחושים... ⏳
                </div>
              ) : filteredSpyData.length === 0 ? (
                <div className="text-center text-slate-500 py-8 font-bold">
                  לא נמצאו ניחושים שמתאימים לחיפוש.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSpyData.map((data, idx) => {
                    let cardStyle = "p-3.5 rounded-xl border transition-all ";
                    if (hasTruth) {
                      if (data.points && data.points > 0)
                        cardStyle += "bg-emerald-900/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                      else cardStyle += "bg-rose-900/10 border-rose-500/20 opacity-80";
                    } else {
                      cardStyle +=
                        data.userId === userId
                          ? "bg-blue-900/10 border-blue-500/30"
                          : "bg-slate-800 border-slate-700";
                    }

                    return (
                      <div key={idx} className={cardStyle}>
                        <div className="flex justify-between items-center mb-2.5">
                          <div className="font-bold text-white text-sm md:text-base flex items-center gap-2">
                            <div
                              className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black border shrink-0 ${
                                data.userRank === 1
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                                  : data.userRank === 2
                                  ? "bg-slate-400/20 text-slate-300 border-slate-400/50 shadow-[0_0_8px_rgba(148,163,184,0.2)]"
                                  : data.userRank === 3
                                  ? "bg-orange-700/30 text-orange-400 border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
                                  : "bg-slate-600 text-white border-slate-500 shadow-sm"
                              }`}
                            >
                              {data.userRank || "-"}
                            </div>
                            <span className="truncate max-w-[120px] sm:max-w-[200px]">
                              {data.userName}
                            </span>
                            {data.userId === userId && (
                              <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">
                                אתה
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-[9px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-700/50 shrink-0">
                              סה״כ: <span className="text-amber-400">{data.userTotalPoints}</span>
                            </div>
                            {hasTruth && data.points !== null && (
                              <div
                                className={`whitespace-nowrap text-[11px] font-black px-2 py-0.5 rounded border ${
                                  data.points > 0
                                    ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50"
                                    : "bg-rose-950/50 text-rose-400 border-rose-500/40"
                                }`}
                              >
                                {data.points > 0 ? `+${data.points}` : "0"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-nowrap overflow-x-auto custom-scrollbar pb-1.5 gap-2 mt-2 bg-slate-950/50 p-2 rounded-lg border border-slate-700/50 shadow-inner">
                          {data.teams.map((t: string, i: number) => {
                            const isHit = realThirdPlace.includes(t);
                            return (
                              <span
                                key={i}
                                className={`whitespace-nowrap shrink-0 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md border flex items-center gap-1.5 ${
                                  isHit
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                    : "bg-slate-900 text-slate-300 border-slate-600"
                                }`}
                              >
                                {getFlagUrl(t) && (
                                  <img
                                    src={getFlagUrl(t)!}
                                    className="w-3.5 h-2.5 object-cover rounded-sm"
                                    alt="flag"
                                  />
                                )}
                                {t}
                                {isHit && "🎯"}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}