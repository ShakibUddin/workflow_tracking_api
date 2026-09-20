const request = require('supertest');
const { app } = require('./auth');

const authCookie = (accessToken) => (accessToken ? [`accessToken=${accessToken}`] : []);

const createTeam = (accessToken, body) =>
  request(app).post('/api/v1/teams').set('Cookie', authCookie(accessToken)).send(body);

const listTeams = (accessToken) => request(app).get('/api/v1/teams').set('Cookie', authCookie(accessToken));

const getTeam = (accessToken, teamId) =>
  request(app).get(`/api/v1/teams/${teamId}`).set('Cookie', authCookie(accessToken));

const updateTeam = (accessToken, teamId, body) =>
  request(app).patch(`/api/v1/teams/${teamId}`).set('Cookie', authCookie(accessToken)).send(body);

const deleteTeam = (accessToken, teamId) =>
  request(app).delete(`/api/v1/teams/${teamId}`).set('Cookie', authCookie(accessToken));

const addMembers = (accessToken, teamId, userIds) =>
  request(app).post(`/api/v1/teams/${teamId}/members`).set('Cookie', authCookie(accessToken)).send({ userIds });

const removeMember = (accessToken, teamId, userId) =>
  request(app).delete(`/api/v1/teams/${teamId}/members/${userId}`).set('Cookie', authCookie(accessToken));

const searchUsers = (accessToken, name) =>
  request(app)
    .get('/api/v1/users/search')
    .query(name !== undefined ? { name } : {})
    .set('Cookie', authCookie(accessToken));

const getUserTeams = (accessToken, userId) =>
  request(app).get(`/api/v1/users/${userId}/teams`).set('Cookie', authCookie(accessToken));

module.exports = {
  createTeam,
  listTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  addMembers,
  removeMember,
  searchUsers,
  getUserTeams,
};
