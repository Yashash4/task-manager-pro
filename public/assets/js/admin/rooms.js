// admin/rooms.js - Complete room management with code rotation
(async function () {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    let currentProfile = null;
    let currentRoom = null;

    async function init() {
        try {
            const auth = await Utils.api.checkAuth();
            if (!auth) return;

            currentProfile = auth.profile;

            if (!currentProfile.role_flags?.includes('admin')) {
                window.location.href = '/login.html';
                return;
            }

            if (currentProfile.room_id) {
                await loadRoomInfo();
                await loadCodeHistory();
            }

        } catch (error) {
            console.error('Init error:', error);
        }
    }

    async function loadRoomInfo() {
        try {
            const { data: room } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', currentProfile.room_id)
                .single();

            if (!room) return;

            currentRoom = room;

            const html = \
                <div style="margin-bottom: 1rem;">
                    <label>Organization Name</label>
                    <input type="text" value="\" disabled class="input">
                </div>

                <div style="margin-bottom: 1rem;">
                    <label>Current Room Code</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" value="\" disabled class="input" style="flex: 1; font-weight: 700; font-family: monospace; font-size: 1.2rem;">
                        <button class="btn" onclick="copyCode('\')" style="padding: 12px 16px;">Copy</button>
                    </div>
                </div>

                <div style="margin-bottom: 1rem;">
                    <label>Created Date</label>
                    <input type="text" value="\" disabled class="input">
                </div>

                <button class="btn secondary" onclick="rotateCode()" style="width: 100%;">?? Rotate Code</button>
            \;

            Utils.dom.setHTML(Utils.dom.id('currentOrgContainer'), html);

        } catch (error) {
            console.error('Load room error:', error);
        }
    }

    async function loadCodeHistory() {
        try {
            const { data: history } = await supabase
                .from('rooms_history')
                .select('*')
                .eq('room_id', currentProfile.room_id)
                .order('rotated_at', { ascending: false });

            const tbody = Utils.dom.id('historyTableBody');

            if (!history || history.length === 0) {
                Utils.dom.setHTML(tbody, '<tr><td colspan="3" style="text-align: center;">No rotation history</td></tr>');
                return;
            }

            const html = history.map(h => \
                <tr>
                    <td><code>\</code></td>
                    <td><code style="color: var(--brand);">\</code></td>
                    <td>\</td>
                </tr>
            \).join('');

            Utils.dom.setHTML(tbody, html);

        } catch (error) {
            console.error('Load history error:', error);
        }
    }

    window.copyCode = async (code) => {
        try {
            await navigator.clipboard.writeText(code);
            alert('Code copied to clipboard!');
        } catch (error) {
            alert('Failed to copy code');
        }
    };

    window.rotateCode = async () => {
        if (!confirm('Rotate room code? Current members will keep access.')) return;

        try {
            // Generate new code
            const { data: newCode, error: codeError } = await supabase.rpc('generate_room_code');
            if (codeError) throw codeError;

            // Record history
            const { error: histError } = await supabase
                .from('rooms_history')
                .insert([{
                    room_id: currentProfile.room_id,
                    old_code: currentRoom.current_code,
                    new_code: newCode,
                    rotated_by: currentProfile.id,
                    rotated_at: new Date().toISOString()
                }]);

            if (histError) throw histError;

            // Update room code
            const { error: updateError } = await supabase
                .from('rooms')
                .update({ current_code: newCode })
                .eq('id', currentProfile.room_id);

            if (updateError) throw updateError;

            alert('Room code rotated successfully!');
            await loadRoomInfo();
            await loadCodeHistory();

        } catch (error) {
            console.error('Rotate error:', error);
            alert('Failed to rotate code');
        }
    };

    document.addEventListener('DOMContentLoaded', init);

})();

console.log('? Admin rooms loaded');
