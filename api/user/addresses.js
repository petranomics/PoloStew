/**
 * User Addresses Endpoint
 * GET/POST/PUT/DELETE /api/user/addresses
 */

import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';
import { parseCookies, verifyAuth } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Parse cookies and verify authentication
  parseCookies(req);
  const authResult = await verifyAuth(req, res);
  if (authResult !== true) return;

  const user = await kv.get(`user:${req.user.id}`);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Ensure addresses array exists
  if (!user.addresses) {
    user.addresses = [];
  }

  // GET - Retrieve all addresses
  if (req.method === 'GET') {
    return res.status(200).json({
      addresses: user.addresses
    });
  }

  // POST - Add new address
  if (req.method === 'POST') {
    try {
      const { type, street, city, state, zip, country, isDefault } = req.body;

      if (!street || !city || !state || !zip || !country) {
        return res.status(400).json({
          error: 'Missing required address fields',
          required: ['street', 'city', 'state', 'zip', 'country']
        });
      }

      const newAddress = {
        id: uuidv4(),
        type: type || 'shipping',
        street,
        city,
        state,
        zip,
        country,
        isDefault: isDefault || false
      };

      // If this is set as default, unset others
      if (newAddress.isDefault) {
        user.addresses.forEach(addr => {
          addr.isDefault = false;
        });
      }

      user.addresses.push(newAddress);
      await kv.set(`user:${req.user.id}`, user);

      return res.status(201).json({
        success: true,
        message: 'Address added successfully',
        address: newAddress,
        addresses: user.addresses
      });

    } catch (error) {
      console.error('Address POST error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT - Update address
  if (req.method === 'PUT') {
    try {
      const { addressId, ...updates } = req.body;

      if (!addressId) {
        return res.status(400).json({ error: 'Address ID required' });
      }

      const addressIndex = user.addresses.findIndex(a => a.id === addressId);

      if (addressIndex === -1) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // Update fields
      Object.assign(user.addresses[addressIndex], updates);

      // If setting as default, unset others
      if (updates.isDefault) {
        user.addresses.forEach((addr, idx) => {
          if (idx !== addressIndex) {
            addr.isDefault = false;
          }
        });
      }

      await kv.set(`user:${req.user.id}`, user);

      return res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        address: user.addresses[addressIndex]
      });

    } catch (error) {
      console.error('Address PUT error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE - Remove address
  if (req.method === 'DELETE') {
    try {
      const { addressId } = req.body;

      if (!addressId) {
        return res.status(400).json({ error: 'Address ID required' });
      }

      const initialLength = user.addresses.length;
      user.addresses = user.addresses.filter(a => a.id !== addressId);

      if (user.addresses.length === initialLength) {
        return res.status(404).json({ error: 'Address not found' });
      }

      await kv.set(`user:${req.user.id}`, user);

      return res.status(200).json({
        success: true,
        message: 'Address removed successfully',
        addresses: user.addresses
      });

    } catch (error) {
      console.error('Address DELETE error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
