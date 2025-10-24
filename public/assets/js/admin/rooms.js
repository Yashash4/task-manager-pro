// ==========================================
// ADMIN ROOMS MANAGEMENT
// ==========================================

let currentProfile = null;
let currentRoom = null;

(async function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) return;

  async function init() {
    try {
      const user = await API.getCurrentUser();
      if (!user) {
        window.location.href = '/auth/login.html';
        return;
      }

      currentProfile = await API.getUserProfile(user.id);
      if (!currentProfile || !currentProfile.role_flags?.includes('admin')) {
        await supabase.auth.signOut();
        window.location.href = '/auth/login.html';
        return;
      }

      // Set org name
      if (currentProfile.room_id) {
        const { data: room } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', currentProfile.room_id)
          .single();
        
        if (room) {
          currentRoom = room;
          DOM.setText(DOM.id('orgName'), room.name);
          displayCurrentRoom();
          loadCodeHistory();
        }
      }

      // Event listeners
      DOM.on(DOM.id('createRoomForm'), 'submit', handleCreateRoom);

    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize');
    }
  }

  function displayCurrentRoom() {
    if (!currentRoom) return;

    const container = DOM.id('currentRoomInfo');
    DOM.setHTML(container, `
      <div class="form-group">
        <label>Room Name</label>
        <input type="text" value="${currentRoom.name}" disabled>
      </div>
      <div class="form-group">
        <label>Current Code</label>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <input type="text" value="${currentRoom.current_code}" disabled style="flex: 1; font-size: 1.2rem; font-weight: 700; font-family: monospace; letter-spacing: 2px;">
          <button class="btn btn-primary btn-sm" onclick="copyRoomCode()">Copy</button>
        </div>
      </div>
      <div class="form-group">
        <label>Created Date</label>
        <input type="text" value="${new Date(currentRoom.created_at).toLocaleDateString()}" disabled>
      </div>
      <button class="btn btn-warning btn-block mt-2" onclick="openRotateModal()">🔄 Rotate Code</button>
    `);
  }

  async function loadCodeHistory() {
    try {
      if (!currentRoom) return;

      const { data: history } = await supabase
        .from('rooms_history')
        .select('old_code, new_code, rotated_by, rotated_at')
        .eq('room_id', currentRoom.id)
        .order('rotated_at', { ascending: false });

      const tbody = DOM.id('codeHistoryBody');
      
      if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No code rotations yet</td></tr>';
        return;
      }

      tbody.innerHTML = history.map(h => `
        <tr>
          <td><code>${h.old_code}</code></td>
          <td><code style="color: var(--primary-color);">${h.new_code}</code></td>
          <td>${h.rotated_by}</td>
          <td>${new Date(h.rotated_at).toLocaleString()}</td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Load history error:', error);
    }
  }

  async function handleCreateRoom(e) {
    e.preventDefault();

    const name = DOM.id('roomName')?.value.trim();
    const description = DOM.id('roomDescription')?.value.trim();

    if (!name) {
      Toast.error('Room name is required');
      return;
    }

    try {
      // Generate code
      const { data: code, error: codeError } = await supabase.rpc('generate_room_code');
      if (codeError) throw codeError;

      // Create room
      const { error: createError } = await supabase
        .from('rooms')
        .insert([{
          name,
          current_code: code,
          created_by: currentProfile.id
        }]);

      if (createError) throw createError;

      Toast.success('Room created successfully!');
      DOM.id('createRoomForm').reset();
      await init();

    } catch (error) {
      console.error('Create room error:', error);
      Toast.error(error.message || 'Failed to create room');
    }
  }

  window.copyRoomCode = async () => {
    if (currentRoom) {
      await copyToClipboard(currentRoom.current_code);
    }
  };

  window.openRotateModal = async () => {
    if (!currentRoom) return;

    try {
      // Generate new code
      const { data: newCode, error } = await supabase.rpc('generate_room_code');
      if (error) throw error;

      DOM.setText(DOM.id('currentCodeDisplay'), currentRoom.current_code);
      DOM.setText(DOM.id('newCodeDisplay'), newCode);
      DOM.removeClass(DOM.id('rotateCodeModal'), 'hidden');

      // Store new code for confirmation
      window.pendingNewCode = newCode;

    } catch (error) {
      console.error('Generate code error:', error);
      Toast.error('Failed to generate new code');
    }
  };

  window.closeRotateModal = () => {
    DOM.addClass(DOM.id('rotateCodeModal'), 'hidden');
    window.pendingNewCode = null;
  };

  window.confirmRotateCode = async () => {
    if (!currentRoom || !window.pendingNewCode) return;

    try {
      // Record old code in history
      const { error: historyError } = await supabase
        .from('rooms_history')
        .insert([{
          room_id: currentRoom.id,
          old_code: currentRoom.current_code,
          new_code: window.pendingNewCode,
          rotated_by: currentProfile.id,
          rotated_at: new Date().toISOString()
        }]);

      if (historyError) throw historyError;

      // Update room with new code
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ current_code: window.pendingNewCode })
        .eq('id', currentRoom.id);

      if (updateError) throw updateError;

      Toast.success('Room code rotated successfully!');
      window.closeRotateModal();
      await init();

    } catch (error) {
      console.error('Rotate code error:', error);
      Toast.error(error.message || 'Failed to rotate code');
    }
  };

  document.addEventListener('DOMContentLoaded', init);

})();

console.log('? Admin rooms loaded');